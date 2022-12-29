use crate::error::ClockPayError::InvalidInstruction;
use borsh::BorshDeserialize;
use solana_program::{program_error::ProgramError, pubkey::Pubkey};

pub enum ClockPayInstruction {
    /// Initializes an accounting instance. Represents the user's global state.
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer, writable]` The initializer.
    /// 1. `[]` Token mint
    /// 2. `[writable]` The program account that stores the state. A pda with seeds &[b"accounting".as_ref(), initializer.key.as_ref()]
    /// 3. `[writable]` The vault: Associated token account for the state pda
    /// 4. `[]` The System Program
    /// 5. `[]` The Token Program
    /// 6. `[]` The AToken Program
    InitAccounting,
    /// Deposits into the Accounting vault
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer, writable]` The authority of the Accounting state account.
    /// 1. `[writable]` The Accounting state account.
    /// 2. `[writable]` The authority's token account to be debited.
    /// 3. `[writable]` The vault
    /// 4. `[]` The Token Program,
    Deposit(DepositArgs),
    /// Adds a beneficiary to the payroll
    ///
    ///
    /// Accounts expected
    ///
    /// 1. `[signer]` The authority of the Accounting state instance.
    /// 2. `[writable]` The Accounting state account.
    /// 3. `[writable]` The vault to be withdrawn from.
    /// 4. `[writable]` The receiver's token account.
    /// 5. `[]` The token program
    /// 6. `[]` Clockwork(I haven't figured this out yet)
    NewPayroll(StartPayArgs),
}

#[derive(BorshDeserialize, Debug)]
pub struct DepositArgs {
    pub amount: u64,
}

#[derive(BorshDeserialize, Debug)]
pub struct StartPayArgs {
    pub time_till_start: u64,
    pub amount: u64,
    pub cycles: u64,
    pub interval: u64,
    pub receiver_key: Pubkey,
}

impl ClockPayInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::unpack_init_accounting_args()?,
            1 => Self::unpack_deposit_args(rest)?,
            2 => Self::unpack_new_payroll_args(rest)?,
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_init_accounting_args() -> Result<Self, ProgramError> {
        Ok(Self::InitAccounting {})
    }

    fn unpack_deposit_args(src: &[u8]) -> Result<Self, ProgramError> {
        let unpacked_args = DepositArgs::try_from_slice(&src)?;
        Ok(Self::Deposit(unpacked_args))
    }

    fn unpack_new_payroll_args(src: &[u8]) -> Result<Self, ProgramError> {
        let unpacked_args = StartPayArgs::try_from_slice(&src)?;
        Ok(Self::NewPayroll(unpacked_args))
    }
}
