use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Copy, Clone, Debug)]
pub enum ClockPayError {
    #[error("Invalid instruction data")]
    InvalidInstruction,
}


impl From<ClockPayError> for ProgramError {
    fn from(e: ClockPayError) -> Self {
        ProgramError::Custom(e as u32)
    }
}