use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Accounting {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub active_payrolls: u64,
    pub vault: Pubkey,
    pub balance: u64,
    pub bump: u8,
}

impl Accounting {
    pub const SIZE: usize = 113;
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Payroll {
    pub accounting: Pubkey,
    pub receiver_token_account: Pubkey,
    pub total_cycles: u64,
    pub cycle_start_time: i64,
    pub cycles_completed: u64,
    pub total_amount_paid: u64,
    pub amount: u64,
    pub interval: u64,
    pub bump: u8, //pub cycle_paused: bool,
                  //pub plan_paused: bool,
}

impl Payroll {
    pub const SIZE: usize = 113;
}
