use solana_program::program_error::ProgramError;
use borsh::BorshDeserialize;
use crate::error::ClockPayError::InvalidInstruction;


pub enum ClockPayInstruction {
    /// Initializes an allowance plan
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer, writable]` The initializer's system account
    /// 1. `[writable]` The program account that stores the state. A pda with seeds &[b"allowance".as_ref(), 
    ///     initializer.key.as_ref(), receiver_token_account.key.as_ref()]
    /// 2. `[]` Token mint
    /// 3. `[writable]` Initializer token account
    /// 4. `[writable]` Receiver token account
    /// 5. `[]` The vault: A pda token account seeded from the state address. Seeds: &[b"vault".as_ref(), state.key.as_ref()]
    /// 6. `[]` The System Program
    /// 7. `[]` The Token Program
    InitAllowance(InitArgs),
}

#[derive(BorshDeserialize, Debug)]
pub struct InitArgs {
    pub time_to_start: u64,
    pub amount: u64,
    pub cycles: u64,
    pub interval: u64,
}

impl ClockPayInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::unpack_init_args(rest)?,
            _ => return Err(InvalidInstruction.into()),
        })
    }

    pub fn unpack_init_args(src: &[u8]) -> Result<Self, ProgramError> {
        let unpacked = InitArgs::try_from_slice(src)?;
        Ok(ClockPayInstruction::InitAllowance(unpacked))
    }
}