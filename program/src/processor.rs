use crate::state::{Accounting, Payroll};
use crate::{error::ClockPayError, instruction::ClockPayInstruction};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock,
    entrypoint::ProgramResult,
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
                    args.time_till_start,
                    args.amount,
                    args.cycles,
                    args.interval,
                    &(args.receiver_key),
                )
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

        let accounting_state_account = next_account_info(account_info_iter)?;
        let (state_pda, state_bump) = Pubkey::find_program_address(
            &[b"accounting".as_ref(), initializer.key.as_ref()],
            program_id,
        );
        if state_pda != *accounting_state_account.key {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let vault_account = next_account_info(account_info_iter)?;
        let system_program = next_account_info(account_info_iter)?;
        if *system_program.key != SystemProgramId {
            return Err(ClockPayError::InvalidAccount.into());
        }
        let token_program = next_account_info(account_info_iter)?;
        if *token_program.key != TokenProgramId {
            return Err(ClockPayError::InvalidAccount.into());
        }
        let associated_token_program = next_account_info(account_info_iter)?;
        if *associated_token_program.key != AssociatedTokenProgramId {
            return Err(ClockPayError::InvalidAccount.into());
        }

        msg!("Initialize accounting state account.");
        if **accounting_state_account.try_borrow_lamports()? > 0 {
            return Err(ClockPayError::AccountAlreadyInitialized.into());
        }
        let state_lamports = Rent::default().minimum_balance(Accounting::SIZE);
        let create_state_account_ix = solana_program::system_instruction::create_account(
            initializer.key,
            accounting_state_account.key,
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
                accounting_state_account.clone(),
                system_program.clone(),
            ],
            &[&state_account_seeds[..]],
        )?;

        msg!("Create token account vault");
        let create_vault_account_ix = create_associated_token_account(
            initializer.key,
            accounting_state_account.key,
            token_mint.key,
            &TokenProgramId,
        );
        invoke(
            &create_vault_account_ix,
            &[
                initializer.clone(),
                vault_account.clone(),
                accounting_state_account.clone(),
                token_mint.clone(),
                system_program.clone(),
                token_program.clone(),
                associated_token_program.clone(),
            ],
        )?;
        
        let mut accounting_info =
            Accounting::try_from_slice(&accounting_state_account.data.borrow())?;
        accounting_info.authority = *initializer.key;
        accounting_info.mint = *token_mint.key;
        accounting_info.active_payrolls = 0;
        accounting_info.vault = *vault_account.key;
        accounting_info.balance = 0;
        accounting_info.bump = state_bump;
        accounting_info.serialize(&mut &mut accounting_state_account.data.borrow_mut()[..])?;

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

        let accounting_state_account = next_account_info(account_info_iter)?;
        if accounting_state_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }
        let (state_pda, state_bump) = Pubkey::find_program_address(
            &[b"accounting".as_ref(), authority.key.as_ref()],
            program_id,
        );
        let mut state_info =
            Accounting::try_from_slice(&accounting_state_account.data.borrow())?;
        if state_pda != *accounting_state_account.key || state_bump != state_info.bump {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let authority_token_account = next_account_info(account_info_iter)?;
        let auth_token_account_info =
            TokenAccount::unpack(&authority_token_account.try_borrow_data()?)?;
        if auth_token_account_info.mint != state_info.mint {
            return Err(ClockPayError::WrongMint.into());
        }

        let vault_account = next_account_info(account_info_iter)?;
        if *vault_account.key != state_info.vault {
            return Err(ClockPayError::InvalidAccount.into());
        }

        let token_program = next_account_info(account_info_iter)?;
        if *token_program.key != TokenProgramId {
            return Err(ClockPayError::InvalidAccount.into());
        }

        msg!("Transfer from authority's token account to vault");
        let create_vault_ix = spl_token::instruction::transfer(
            &TokenProgramId,
            authority_token_account.key,
            vault_account.key,
            authority.key,
            &[&authority.key],
            amount,
        )?;

        invoke(
            &create_vault_ix,
            &[
                authority_token_account.clone(),
                vault_account.clone(),
                authority.clone(),
            ],
        )?;

        state_info.balance = state_info.balance.checked_add(amount).unwrap();
        state_info.serialize(&mut &mut accounting_state_account.data.borrow_mut()[..])?;
        Ok(())
    }

    fn process_new_payroll(
        _accounts: &[AccountInfo],
        _program_id: &Pubkey,
        _time_till_start: u64,
        _amount: u64,
        _cycles: u64,
        _interval: u64,
        _receiver_key: &Pubkey,
    ) -> ProgramResult {
        /*
        let account_info_iter = &mut accounts.iter();
        let initializer = next_account_info(account_info_iter)?;
        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let token_mint = next_account_info(account_info_iter)?;

        let receiver_token_account = next_account_info(account_info_iter)?;
        let receiver_token_account_info = TokenAccount::unpack(&receiver_token_account.try_borrow_data()?)?;
        msg!("token account owner: {:?}", receiver_token_account_info.owner);
        if receiver_token_account_info.owner != *receiver_key {
            return Err(ClockPayError::WrongTokenAccountOwner.into());
        }
        if receiver_token_account_info.mint != *token_mint.key {
            return Err(ClockPayError::WrongMint.into());
        }

        let allowance_state_account = next_account_info(account_info_iter)?;
        let (state_pda, state_bump) = Pubkey::find_program_address(&[b"allowance".as_ref(), initializer.key.as_ref(), receiver_key.as_ref()], program_id);
        if state_pda != *allowance_state_account.key {
            return Err(ClockPayError::InvalidAccount.into())
        }

        let initializer_token_account = next_account_info(account_info_iter)?;
        let initializer_token_account_info = TokenAccount::Unpack(&initializer_token_account.try_borrow_data()?)?;
        if initializer_token_account_info.mint != *token_mint.key {
            return Err(ClockPayError::WrongMint.into())
        }



        let clock = clock::Clock::default();
        let mut state_info = Allowance::try_from_slice(&allowance_state_account.data.borrow())?;
        state_info.initializer = *initializer_account.key;
        state_info.mint = *token_mint.key;
        state_info.receiver_token_account = *receiver_token_account.key;
        state_info.vault = *vault_account.key;
        state_info.balance = 0;
        state_info.cycles = cycles;
        state_info.cycle_start_time = clock.unix_timestamp;
        state_info.amount = amount;
        state_info.cycles = cycles;
        state_info.cycle_start_time = clock.unix_timestamp.checked_add()*/

        Ok(())
    }
}
