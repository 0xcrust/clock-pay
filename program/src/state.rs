use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Allowance {
    pub initializer: Pubkey,
    pub mint: Pubkey,
    pub receiver_token_account: Pubkey,
    pub vault: Pubkey,
    pub cycles: u64,
    pub cycle_start_time: i64,
    pub amount: u64,
    pub interval: u64,
    pub cycle_paused: bool,
    pub plan_paused: bool,
}

impl Allowance {
    pub fn size() -> usize {
        std::mem::size_of::<Self>()
    }
}