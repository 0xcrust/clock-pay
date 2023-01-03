use crate::state::{Accounting, Payroll};
use crate::{error::ClockPayError, instruction::ClockPayInstruction};
use anchor_lang::context::CpiContext;
use borsh::{BorshDeserialize, BorshSerialize};
use clockwork_sdk::state::{ThreadResponse, Trigger};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_program::ID as SystemProgramId,
};
use spl_associated_token_account::{
    instruction::create_associated_token_account, ID as AssociatedTokenProgramId,
};
use spl_token::{
    state::{Account as TokenAccount, Mint as MintAccount},
    ID as TokenProgramId,
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = ClockPayInstruction::unpack(instruction_data)?;

        match instruction {
            ClockPayInstruction::InitAccounting => {
                msg!("Instruction: Initialize accounting");
                Self::process_init_accounting(accounts, program_id)
            }
            ClockPayInstruction::Deposit(args) => {
                msg!("Instruction: Deposit");
                Self::process_deposit(accounts, program_id, args.amount)
            }
            ClockPayInstruction::NewPayroll(args) => {
                msg!("Instruction: Create new payroll");
                Self::process_new_payroll(
                    accounts,
                    program_id,
                    args.amount,
                    args.cycles,
                    args.schedule,
                )
            }
            ClockPayInstruction::InitPayment => {
                msg!("Instruction: Make payment");
                Self::process_init_payment(accounts, program_id)
            }
            ClockPayInstruction::Pay => {
                msg!("Instruction: Process payment");
                Self::process_pay(accounts, program_id)?;
                Ok(())
            }
        }
    }

    fn process_init_accounting(accounts: &[AccountInfo], program_id: &Pubkey) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let initializer = next_account_info(account_info_iter)?;
        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_mint = next_account_info(account_info_iter)?;
        MintAccount::unpack(&token_mint.try_borrow_data()?)?;

        let accounting_state = next_account_info(account_info_iter)?;
        let (state_pda, state_bump) = Pubkey::find_program_address(
            &[b"accounting".as_ref(), initializer.key.as_ref()],
            program_id,
        );
        if state_pda != *accounting_state.key {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let vault_account = next_account_info(account_info_iter)?;

        let system_program = next_account_info(account_info_iter)?;
        let token_program = next_account_info(account_info_iter)?;
        let atoken_program = next_account_info(account_info_iter)?;
        if *system_program.key != SystemProgramId
            || *token_program.key != TokenProgramId
            || *atoken_program.key != AssociatedTokenProgramId
        {
            return Err(ProgramError::IncorrectProgramId);
        }

        msg!("Initialize accounting state account.");
        if **accounting_state.try_borrow_lamports()? > 0 {
            return Err(ClockPayError::AccountAlreadyInitialized.into());
        }
        let state_lamports = Rent::default().minimum_balance(Accounting::SIZE);
        let create_state_account_ix = solana_program::system_instruction::create_account(
            initializer.key,
            accounting_state.key,
            state_lamports,
            Accounting::SIZE as u64,
            program_id,
        );
        let state_account_seeds = &[
            b"accounting".as_ref(),
            initializer.key.as_ref(),
            &[state_bump],
        ];
        invoke_signed(
            &create_state_account_ix,
            &[
                initializer.clone(),
                accounting_state.clone(),
                system_program.clone(),
            ],
            &[&state_account_seeds[..]],
        )?;

        msg!("Create token account vault");
        let create_vault_account_ix = create_associated_token_account(
            initializer.key,
            accounting_state.key,
            token_mint.key,
            &TokenProgramId,
        );
        invoke(
            &create_vault_account_ix,
            &[
                initializer.clone(),
                vault_account.clone(),
                accounting_state.clone(),
                token_mint.clone(),
                system_program.clone(),
                token_program.clone(),
                atoken_program.clone(),
            ],
        )?;

        let mut accounting_info = Accounting::try_from_slice(&accounting_state.data.borrow())?;
        accounting_info.authority = *initializer.key;
        accounting_info.mint = *token_mint.key;
        accounting_info.active_payrolls = 0;
        accounting_info.vault = *vault_account.key;
        accounting_info.balance = 0;
        accounting_info.active = true;
        accounting_info.bump = state_bump;
        accounting_info.serialize(&mut &mut accounting_state.data.borrow_mut()[..])?;

        Ok(())
    }

    fn process_deposit(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
        amount: u64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority = next_account_info(account_info_iter)?;
        if !authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let accounting_state = next_account_info(account_info_iter)?;
        if accounting_state.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        let (state_pda, state_bump) = Pubkey::find_program_address(
            &[b"accounting".as_ref(), authority.key.as_ref()],
            program_id,
        );
        let mut accounting_info = Accounting::try_from_slice(&accounting_state.data.borrow())?;
        if state_pda != *accounting_state.key || state_bump != accounting_info.bump {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let authority_token_account = next_account_info(account_info_iter)?;
        let auth_token_account_info =
            TokenAccount::unpack(&authority_token_account.try_borrow_data()?)?;
        if auth_token_account_info.mint != accounting_info.mint {
            return Err(ClockPayError::WrongMint.into());
        }

        let vault_account = next_account_info(account_info_iter)?;
        if *vault_account.key != accounting_info.vault {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let token_program = next_account_info(account_info_iter)?;
        if *token_program.key != TokenProgramId {
            return Err(ClockPayError::InvalidAccount.into());
        }

        msg!("Transfer from authority's token account to vault");
        let transfer_ix = spl_token::instruction::transfer(
            &TokenProgramId,
            authority_token_account.key,
            vault_account.key,
            authority.key,
            &[&authority.key],
            amount,
        )?;

        invoke(
            &transfer_ix,
            &[
                authority_token_account.clone(),
                vault_account.clone(),
                authority.clone(),
            ],
        )?;

        accounting_info.balance = accounting_info.balance.checked_add(amount).unwrap();
        accounting_info.serialize(&mut &mut accounting_state.data.borrow_mut()[..])?;
        Ok(())
    }

    fn process_new_payroll(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
        amount: u64,
        cycles: u64,
        schedule: [u8; 30],
    ) -> ProgramResult {
        if schedule.len() > Payroll::SCHEDULE_LEN {
            return Err(ClockPayError::ScheduleLengthExceeded.into())
        }
        let account_info_iter = &mut accounts.iter();
        let authority = next_account_info(account_info_iter)?;
        if !authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let accounting_state = next_account_info(account_info_iter)?;
        if accounting_state.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        let (accounting_pda, accounting_bump) = Pubkey::find_program_address(
            &[b"accounting".as_ref(), authority.key.as_ref()],
            program_id,
        );
        let accounting_info = Accounting::try_from_slice(&accounting_state.data.borrow())?;
        if accounting_pda != *accounting_state.key || accounting_bump != accounting_info.bump {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let payroll_account = next_account_info(account_info_iter)?;
        let receiver = next_account_info(account_info_iter)?;

        let system_program = next_account_info(account_info_iter)?;
        if *system_program.key != SystemProgramId {
            return Err(ProgramError::IncorrectProgramId);
        }

        let (payroll_pda, payroll_bump) = Pubkey::find_program_address(
            &[b"payroll", accounting_state.key.as_ref(), receiver.key.as_ref()],
            program_id,
        );
        if payroll_pda != *payroll_account.key {
            return Err(ClockPayError::InvalidAccount.into());
        }
        msg!("Initialize payroll account");
        if **payroll_account.try_borrow_lamports()? > 0 {
            return Err(ClockPayError::AccountAlreadyInitialized.into());
        }
        let lamports = Rent::default().minimum_balance(Payroll::SIZE);
        let create_payroll_account_ix = solana_program::system_instruction::create_account(
            authority.key,
            payroll_account.key,
            lamports,
            Payroll::SIZE as u64,
            program_id,
        );
        let payroll_account_seeds = &[
            b"payroll".as_ref(),
            accounting_state.key.as_ref(),
            receiver.key.as_ref(),
            &[payroll_bump],
        ];
        invoke_signed(
            &create_payroll_account_ix,
            &[
                authority.clone(),
                payroll_account.clone(),
                system_program.clone(),
            ],
            &[&payroll_account_seeds[..]],
        )?;

        msg!("Deserializing payroll...");
        let mut payroll_info = Payroll::try_from_slice(&payroll_account.data.borrow())?;
        payroll_info.accounting = *accounting_state.key;
        payroll_info.active = false;
        payroll_info.amount = amount;
        payroll_info.total_amount_disbursed = 0;
        payroll_info.cron_schedule = schedule;
        payroll_info.receiver = *receiver.key;
        payroll_info.max_cycles = cycles;
        payroll_info.cycles_completed = 0;
        payroll_info.bump = payroll_bump;
        msg!("Serializing payroll...");
        payroll_info.serialize(&mut &mut payroll_account.data.borrow_mut()[..])?;

        Ok(())
    }

    fn process_init_payment(accounts: &[AccountInfo], program_id: &Pubkey) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let authority = next_account_info(account_info_iter)?;
        let accounting = next_account_info(account_info_iter)?;
        let payroll = next_account_info(account_info_iter)?;
        let vault = next_account_info(account_info_iter)?;
        let receiver_wallet = next_account_info(account_info_iter)?;
        let thread = next_account_info(account_info_iter)?;
        let thread_program = next_account_info(account_info_iter)?;
        let token_program = next_account_info(account_info_iter)?;
        let system_program = next_account_info(account_info_iter)?;

        let pay_ix = Instruction {
            program_id: *program_id,
            accounts: vec![
                AccountMeta::new(*payroll.key, false),
                AccountMeta::new(*accounting.key, false),
                AccountMeta::new(*vault.key, false),
                AccountMeta::new(*receiver_wallet.key, false),
                AccountMeta::new(*thread.key, true),
                AccountMeta::new_readonly(*token_program.key, false),
            ],
            data: (4 as u64).to_le_bytes().into(),
        };

        let mut payroll_info = Payroll::try_from_slice(&payroll.data.borrow())?;
        let payroll_seeds = &[
            b"payroll".as_ref(),
            payroll_info.accounting.as_ref(),
            payroll_info.receiver.as_ref(),
            &[payroll_info.bump],
        ];
        let thread_id = &payroll_info.receiver.to_string()[0..10];

        let cron_bytes: std::vec::Vec<u8> = payroll_info.cron_schedule.into_iter().filter(|&x| x != 0).collect();
        let schedule = String::from_utf8(cron_bytes.into()).unwrap();
        let schedule = schedule.trim_end();

        msg!("Schedule: {:?}", schedule);
        msg!("Create thread for pay_ix");
        msg!("payroll authority: {:?}", payroll.clone().key);
        msg!("thread_id: {:?}", thread_id);
        clockwork_sdk::cpi::thread_create(
            CpiContext::new_with_signer(
                (*thread_program).clone(),
                clockwork_sdk::cpi::ThreadCreate {
                    authority: payroll.clone(),
                    payer: authority.clone(),
                    system_program: system_program.clone(),
                    thread: thread.clone(),
                },
                &[&payroll_seeds[..]],
            ),
            thread_id.to_string(),
            pay_ix.into(),
            Trigger::Cron {
                schedule: schedule.to_string(),
                skippable: false,
            },
        )?;

        let mut accounting_info = Accounting::try_from_slice(&accounting.data.borrow())?;
        accounting_info.active_payrolls = accounting_info.active_payrolls.checked_add(1).unwrap();
        accounting_info.serialize(&mut &mut accounting.data.borrow_mut()[..])?;

        payroll_info.active = true;
        payroll_info.thread = *thread.key;
        payroll_info.serialize(&mut &mut payroll.data.borrow_mut()[..])?;

        Ok(())
    }

    fn process_pay(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> Result<ThreadResponse, ProgramError> {
        let account_info_iter = &mut accounts.iter();
        let payroll = next_account_info(account_info_iter)?;
        let accounting = next_account_info(account_info_iter)?;
        let vault = next_account_info(account_info_iter)?;
        let receiver_wallet = next_account_info(account_info_iter)?;
        let _thread = next_account_info(account_info_iter)?;
        let token_program = next_account_info(account_info_iter)?;

        let mut accounting_info = Accounting::try_from_slice(&accounting.data.borrow())?;
        let mut payroll_info = Payroll::try_from_slice(&payroll.data.borrow())?;

        if payroll_info.cycles_completed >= payroll_info.max_cycles {
            return Err(ClockPayError::TriedExceedingPaymentLimit.into());
        }

        if payroll.owner != program_id || accounting.owner != program_id {
            return Err(ClockPayError::InvalidAccount.into());
        }
        let receiver_wallet_info = TokenAccount::unpack(&receiver_wallet.try_borrow_data()?)?;
        if receiver_wallet_info.owner != payroll_info.receiver {
            return Err(ClockPayError::WrongTokenAccountOwner.into());
        }

        msg!("Transferring payment to {:?}", *receiver_wallet);
        let accounting_seeds = &[
            b"accounting".as_ref(),
            accounting_info.authority.as_ref(),
            &[accounting_info.bump],
        ];
        let transfer_ix = spl_token::instruction::transfer(
            &TokenProgramId,
            vault.key,
            receiver_wallet.key,
            accounting.key,
            &[&accounting.key],
            payroll_info.amount,
        )?;

        invoke_signed(
            &transfer_ix,
            &[
                vault.clone(),
                receiver_wallet.clone(),
                accounting.clone(),
                token_program.clone(),
            ],
            &[&accounting_seeds[..]],
        )?;

        accounting_info.balance = accounting_info
            .balance
            .checked_sub(payroll_info.amount)
            .unwrap();
        payroll_info.total_amount_disbursed = payroll_info
            .total_amount_disbursed
            .checked_add(payroll_info.amount)
            .unwrap();
        payroll_info.cycles_completed = payroll_info.cycles_completed.checked_add(1).unwrap();

        accounting_info.serialize(&mut &mut accounting.data.borrow_mut()[..])?;
        payroll_info.serialize(&mut &mut payroll.data.borrow_mut()[..])?;

        Ok(ThreadResponse::default())
    }
}
