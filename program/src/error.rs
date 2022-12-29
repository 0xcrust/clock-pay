use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Copy, Clone, Debug)]
pub enum ClockPayError {

}


impl From<ClockPayError> for ProgramError {
    fn from(e: ClockPayError) -> Self {
        ProgramError::custom(e as u32)
    }
}