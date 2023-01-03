use crate::error::ClockPayError::InvalidInstruction;
use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;

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
    /// Initializes a new payroll
    ///
    ///
    /// Accounts expected
    ///
    /// 1. `[signer]` The authority of the Accounting state instance.
    /// 2. `[writable]` The Accounting state account.
    /// 3. `[writable]` The payroll account to be created. A pda with seeds [b"payroll".as_ref(), accounting.key.as_ref(), receiver.key.as_ref()]
    /// 4. `[]` The receiver's key
    /// 5. `[]` The System Program,
    NewPayroll(NewPayrollArgs),
    /// Initializes the clockwork instance to pay iteratively
    ///
    ///
    /// Accounts expected:
    ///
    /// 1. `[writable, signer]` The authority.
    /// 2. `[writable]` The accounting state pda. Acts as a signer
    /// 3. `[writable]` The payroll state pda
    /// 4. `[writable]` The vault
    /// 5. `[writable]` The receiver's wallet
    /// 6. `[writable]` The Thread
    /// 7. `[]` The Thread program
    /// 8. `[]` The Token Program
    /// 9. `[]` The System Program
    InitPayment,
    /// Automated by clockwork from inside the make payment instruction
    ///
    /// Accounts expected:
    ///
    /// 1. `[writable]` The payroll state.
    /// 2. `[writable]` The accounting state.
    /// 3. `[writable]` The vault to be withdrawn from
    /// 4. `[writable]` The receiver's wallet
    /// 5. `[]` The token program
    Pay,
}

#[derive(BorshDeserialize, Debug)]
pub struct DepositArgs {
    pub amount: u64,
}

#[derive(BorshDeserialize, Debug)]
pub struct NewPayrollArgs {
    pub amount: u64,
    pub cycles: u64,
    pub schedule: [u8; 30],
}


impl ClockPayInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::unpack_init_accounting_args()?,
            1 => Self::unpack_deposit_args(rest)?,
            2 => Self::unpack_new_payroll_args(rest)?,
            3 => Self::unpack_init_payment_args()?,
            4 => Self::unpack_pay_args()?,
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_init_accounting_args() -> Result<Self, ProgramError> {
        Ok(Self::InitAccounting)
    }

    fn unpack_deposit_args(src: &[u8]) -> Result<Self, ProgramError> {
        let unpacked_args = DepositArgs::try_from_slice(&src)?;
        Ok(Self::Deposit(unpacked_args))
    }

    fn unpack_new_payroll_args(src: &[u8]) -> Result<Self, ProgramError> {
        let unpacked_args = NewPayrollArgs::try_from_slice(&src)?;
        Ok(Self::NewPayroll(unpacked_args))
    }

    fn unpack_init_payment_args() -> Result<Self, ProgramError> {
        Ok(Self::InitPayment)
    }

    fn unpack_pay_args() -> Result<Self, ProgramError> {
        Ok(Self::Pay)
    }
}
