use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::InstructionData;
use anchor_spl::token::{Token, Transfer, TokenAccount, Approve};

use clockwork_sdk::{
    ThreadProgram,
    state::{Thread, ThreadResponse, Trigger, ThreadAccount},
};

declare_id!("8i26WfxnU6aY12m9YPzzUtj11UrXXPJXT2YrDgzxFoV8");

#[program]
pub mod auto {
    use super::*;

    pub fn init_bursary(ctx: Context<InitBursary>, delegated_amount: u64) -> Result<()> {
        let initializer = &ctx.accounts.initializer;
        let vault_authority = &ctx.accounts.vault_authority;
        let vault = &ctx.accounts.vault;
        let bursary = &mut ctx.accounts.bursary;
        let token_program = &ctx.accounts.token_program;

        msg!("Delegate tokens to bursary {:?}", bursary.key());
        anchor_spl::token::approve(
            CpiContext::new(
                token_program.to_account_info(),
                Approve {
                    to: vault.to_account_info(),
                    delegate: bursary.to_account_info(),
                    authority: vault_authority.to_account_info(),
                }
            ),
            delegated_amount
        )?;

        bursary.authority = initializer.key();
        bursary.active_payments = 0;
        bursary.vault = vault.key();
        bursary.balance = delegated_amount;
        bursary.suspended = false;
        bursary.bump = *ctx.bumps.get("bursary").unwrap();  

        Ok(())
    }

    pub fn init_pay(ctx: Context<InitPay>, amount: u64, schedule: String, cycles: u64) -> Result<()> {
        let authority = &ctx.accounts.authority;
        let bursary = &mut ctx.accounts.bursary;
        let vault = &ctx.accounts.vault;
        let pay_instance = &mut ctx.accounts.pay_instance;
        let receiver_wallet = &ctx.accounts.receiver_wallet;
        let thread = &ctx.accounts.thread;
        let system_program = &ctx.accounts.system_program;
        let token_program = &ctx.accounts.token_program;
        let thread_program = &ctx.accounts.thread_program;

        let pay_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(pay_instance.key(), false),
                AccountMeta::new(bursary.key(), false),
                AccountMeta::new(vault.key(), false),
                AccountMeta::new(receiver_wallet.key(), false),
                AccountMeta::new(thread.key(), true),
                AccountMeta::new_readonly(token_program.key(), false),
            ],
            data: crate::instruction::Pay.data()
        };

        let bump = *ctx.bumps.get("pay_instance").unwrap();
        let bursary_key = bursary.key();
        let receiver_wallet_key = receiver_wallet.key();
        let pay_instance_seeds = &[
            b"pay".as_ref(),
            bursary_key.as_ref(),
            receiver_wallet_key.as_ref(),
            &[bump]
        ];

        let thread_id = &receiver_wallet.key().to_string()[0..10];

        msg!("Create thread for pay instance {:?}", pay_instance.key());
        clockwork_sdk::cpi::thread_create(
            CpiContext::new_with_signer(
                thread_program.to_account_info(),
                clockwork_sdk::cpi::ThreadCreate {
                    authority: pay_instance.to_account_info(),
                    payer: authority.to_account_info(),
                    system_program: system_program.to_account_info(),
                    thread: thread.to_account_info(),
                },
                &[&pay_instance_seeds[..]]
            ),
            thread_id.to_string(),
            pay_ix.into(),
            Trigger::Cron {
                schedule: schedule.clone(),
                skippable: false,
            }
        )?;

        bursary.active_payments = bursary.active_payments.checked_add(1).unwrap();

        pay_instance.bursary = bursary.key();
        pay_instance.payment_active = true;
        pay_instance.amount = amount;
        pay_instance.total_amount_disbursed = 0;
        pay_instance.cron_schedule = schedule;
        pay_instance.cycles = cycles;
        pay_instance.cycles_completed = 0;
        pay_instance.receiver_wallet = receiver_wallet.key();
        pay_instance.thread = thread.key();
        pay_instance.start_time = Clock::get().unwrap().unix_timestamp;
        pay_instance.bump = bump;

        Ok(())
    }


    pub fn pay(ctx: Context<Pay>) -> Result<ThreadResponse> {
        let pay_instance = &mut ctx.accounts.pay_instance;
        let bursary = &mut ctx.accounts.bursary;
        let vault = &ctx.accounts.vault;
        let receiver_wallet = &ctx.accounts.receiver_wallet;
        let token_program = &ctx.accounts.token_program;

        msg!("Disburse to {:?}", receiver_wallet.key());
        let bursary_seeds = &[
            b"bursary".as_ref(),
            bursary.authority.as_ref(),
            bursary.vault.as_ref(),
            &[bursary.bump]
        ];

        let amount = pay_instance.amount;
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                Transfer {
                    from: vault.to_account_info(),
                    to: receiver_wallet.to_account_info(),
                    authority: bursary.to_account_info(),
                },
                &[&bursary_seeds[..]],
            ),
            amount
        )?;

        pay_instance.total_amount_disbursed = 
            pay_instance.total_amount_disbursed.checked_add(amount).unwrap();
        pay_instance.cycles_completed = 
            pay_instance.cycles_completed.checked_add(1).unwrap();

        bursary.balance = bursary.balance.checked_sub(amount).unwrap();

        Ok(ThreadResponse::default())
    }
}

#[derive(Accounts)]
pub struct InitBursary<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(mut, constraint = vault.owner == vault_authority.key() @ ClockPayError::WrongVaultAuthority)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: Assert that vault_authority is the owner of vault
    #[account(signer)]
    pub vault_authority: AccountInfo<'info>,
    #[account(
        init,
        space = 8 + Bursary::SIZE,
        payer = initializer,
        seeds = [b"bursary".as_ref(), initializer.key().as_ref(), vault.key().as_ref()],
        bump,
    )]
    pub bursary: Account<'info, Bursary>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitPay<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority, has_one = vault)]
    pub bursary: Account<'info, Bursary>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init,
        space = PayInstance::SIZE,
        payer = authority,
        seeds = [b"pay".as_ref(), bursary.key().as_ref(), receiver_wallet.key().as_ref()],
        bump,
    )]
    pub pay_instance: Account<'info, PayInstance>,
    #[account(constraint = receiver_wallet.mint == vault.mint)]
    pub receiver_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub thread: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    #[account(address = clockwork_sdk::ID)]
    pub thread_program: Program<'info, ThreadProgram>,
}

#[derive(Accounts)]
pub struct Pay<'info> {
    #[account(mut, has_one = bursary, has_one = receiver_wallet, has_one = thread)]
    pub pay_instance: Account<'info, PayInstance>,
    #[account(mut, has_one = vault)]
    pub bursary: Account<'info, Bursary>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub receiver_wallet: Account<'info, TokenAccount>,
    #[account(
        signer,
        address = thread.pubkey(),
        constraint = thread.authority.eq(&pay_instance.key()),
        constraint = thread.id.eq(&receiver_wallet.key().to_string()[0..10])
    )]
    pub thread: Box<Account<'info, Thread>>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Bursary {
    pub authority: Pubkey,
    pub active_payments: u64,
    pub vault: Pubkey,
    pub balance: u64,
    pub suspended: bool,
    pub bump: u8
}
impl Bursary {
    const SIZE: usize = 32 + 8 + 32 + 8 + 1 + 1;
}

#[account]
pub struct PayInstance {
    bursary: Pubkey,
    payment_active: bool,
    amount: u64,
    total_amount_disbursed: u64,
    cron_schedule: String,
    cycles: u64,
    cycles_completed: u64,
    receiver_wallet: Pubkey,
    thread: Pubkey,
    start_time: i64,
    bump: u8,
}
impl PayInstance{
    const MAX_CRON_LEN: usize = 30;
    pub const SIZE: usize = 32 + 1 + 8 + 8 + (4 + Self::MAX_CRON_LEN) + 8 + 8 + 32 + 32 + 8 + 1;
}

#[error_code]
pub enum ClockPayError{
    #[msg("Invalid string")]
    InvalidString,
    #[msg("Delegated amount less than amount to be paid")]
    NotEnoughDelegated,
    #[msg("Wrong authority for vault")]
    WrongVaultAuthority,
}
