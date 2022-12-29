use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Copy, Clone, Debug)]
pub enum ClockPayError {
    #[error("Invalid instruction data")]
    InvalidInstruction,
    #[error("Token account's owner is not what we expect")]
    WrongTokenAccountOwner,
    #[error("Invalid account")]
    InvalidAccount,
    #[error("Tried to create an existing account")]
    AccountAlreadyInitialized,
    #[error("Wrong token mint")]
    WrongMint,
    #[error("Wrong authority for this instruction")]
    WrongAuthority,
}

impl From<ClockPayError> for ProgramError {
    fn from(e: ClockPayError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
