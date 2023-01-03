use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Accounting {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub active_payrolls: u64,
    pub vault: Pubkey,
    pub balance: u64,
    pub active: bool,
    pub bump: u8,
}

impl Accounting {
    pub const SIZE: usize = 32 + 32 + 8 + 32 + 8 + 1 + 1;
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Payroll {
    pub accounting: Pubkey,
    pub active: bool,
    pub amount: u64,
    pub total_amount_disbursed: u64,
    pub cron_schedule: [u8; 30],
    pub receiver: Pubkey,
    pub max_cycles: u64,
    pub cycles_completed: u64,
    pub thread: Pubkey,
    pub bump: u8,
}

impl Payroll {
    pub const SCHEDULE_LEN: usize = 30;
    pub const SIZE: usize = 32 + 1 + 8 + 8 + (30) + 32 + 8 + 8 + 32 + 1;
}
