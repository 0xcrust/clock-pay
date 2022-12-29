use spl_associated_token_account::{
    instruction::create_associated_token_account,
};

use crate::{
    error::ClockPayError,
    instruction::ClockPayInstruction,
};

use crate::state::Allowance;

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
        accounts: &[AccountInfo],
        program_id: &Pubkey,
        time_to_start: u64,
        amount: u64,
        cycles: u64,
        interval: u64
    ) -> ProgramResult {
        Ok(())
    }
}