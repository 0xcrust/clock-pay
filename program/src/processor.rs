use spl_associated_token_account::{
    instruction::create_associated_token_account,
};

use crate::{
    error::ClockPayError,
    instruction::ClockPayInstruction,
};

use crate::state::Allowance;
use solana_program::{
    account_info::AccountInfo,
    msg,
    pubkey::Pubkey,
    entrypoint::ProgramResult,
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
            ClockPayInstruction::InitAllowance(args) => {
                msg!("Instruction: Initialize allowance");
                Self::process_init_allowance(
                    accounts, program_id, args.time_to_start, args.amount, args.cycles, args.interval)
            }
        }
    }

    fn process_init_allowance(
        _accounts: &[AccountInfo],
        _program_id: &Pubkey,
        _time_to_start: u64,
        _amount: u64,
        _cycles: u64,
        _interval: u64
    ) -> ProgramResult {
        Ok(())
    }
}