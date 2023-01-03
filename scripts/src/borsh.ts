import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import * as borsh from 'borsh';

class DepositArgs {
  amount = new BN(0);
  constructor(fields: {amount: BN} | undefined = undefined) {
    if(fields) {
      this.amount = fields.amount;
    }
  }
}

const DepositSchema = new Map([
  [DepositArgs, {kind: 'struct', fields: [['amount', 'u64']]}],
]);

export function serializeDepositArgs(amount: BN): Uint8Array {
  const args = borsh.serialize(
    DepositSchema,
    new DepositArgs({
      amount: amount
    })
  );
  return args;
}


class NewPayrollArgs {
  amount = new BN(0);
  cycles = new BN(0);
  schedule = Buffer.from("", "utf8");
  constructor (fields: {amount: BN, cycles: BN, schedule: Buffer} 
    | undefined = undefined) {
      if (fields) {
        this.amount = fields.amount;
        this.cycles = fields.cycles;
        this.schedule = fields.schedule;
      }
    }
}

const NewPayrollSchema = new Map([
  [
    NewPayrollArgs, 
    {
      kind: 'struct', 
      fields: [
        ['amount', 'u64'],
        ['cycles', 'u64'],
        ['schedule', [30]],
      ]
    }
  ]
]);

export function serializeNewPayrollArgs(
  amount: BN, cycles: BN, schedule: string): Uint8Array {
  let bytes = Buffer.alloc(30);
  bytes.write(schedule, "utf8");

  const args = borsh.serialize(
    NewPayrollSchema,
    new NewPayrollArgs({
      amount: amount,
      cycles: cycles,
      schedule: bytes,
    }),
  );
  return args;
}


export class AccountingState {
  authority = PublicKey.default;
  mint = PublicKey.default;
  activePayrolls = new BN(0);
  vault = PublicKey.default;
  balance = new BN(0);
  active = false;
  bump = 0;
  constructor(fields: {
    authority: Uint8Array, mint: Uint8Array, active_payrolls: BN, 
    vault: Uint8Array, balance: BN, active: boolean, bump: number
  } | undefined = undefined) {
    if (fields) {
      this.authority = new PublicKey(fields.authority);
      this.mint = new PublicKey(fields.mint);
      this.activePayrolls = fields.active_payrolls,
      this.vault = new PublicKey(fields.vault);
      this.balance = fields.balance;
      this.active = fields.active;
      this.bump = fields.bump;
    }
  }
}

export const AccountingSchema = new Map([
  [
    AccountingState,
    {
      kind: 'struct',
      fields: [
        ['authority', [32]],
        ['mint', [32]],
        ['active_payrolls', 'u64'],
        ['vault', [32]],
        ['balance', 'u64'],
        ['active', 'u8'],
        ['bump', 'u8'],
      ]
    }
  ]
]);

export function deserializeAccountingState(data: Buffer): AccountingState {
  let state = borsh.deserialize(
    AccountingSchema,
    AccountingState,
    data
  );
  return state;
}


export class PayRoll {
  accounting = PublicKey.default;
  active = false;
  amount = new BN(0);
  totalAmountDisbursed = new BN(0);
  cronSchedule = "";
  receiver = PublicKey.default;
  maxCycles = new BN(0);
  cyclesCompleted = new BN(0);
  thread = PublicKey.default;
  bump = 0;
  constructor(fields: {
    accounting: Uint8Array, active: boolean, amount: BN, total_amount_disbursed: BN,
    cron_schedule: Uint8Array, receiver: Uint8Array, max_cycles: BN, cycles_completed: BN, 
    thread: Uint8Array, bump: number} | undefined = undefined) 
  {
    if(fields) {
      let schedule = fields.cron_schedule.filter(x => x != 0);

      this.accounting = new PublicKey(fields.accounting);
      this.active = fields.active;
      this.amount = fields.amount;
      this.totalAmountDisbursed = fields.total_amount_disbursed;
      this.cronSchedule = new TextDecoder().decode(schedule),
      this.receiver = new PublicKey(fields.receiver);
      this.maxCycles = fields.max_cycles;
      this.cyclesCompleted = fields.cycles_completed;
      this.thread = new PublicKey(fields.thread);
      this.bump = fields.bump;
    }
  }
}

export const PayrollSchema = new Map([
  [
    PayRoll,
    {
      kind: 'struct',
      fields: [
        ['accounting', [32]],
        ['active', 'u8'],
        ['amount', 'u64'],
        ['total_amount_disbursed', 'u64'],
        ['cron_schedule', [30]],
        ['receiver', [32]],
        ['max_cycles', 'u64'],
        ['cycles_completed', 'u64'],
        ['thread', [32]],
        ['bump', 'u8'],
      ]
    }
  ]
]);

export function deserializePayrollState(data: Buffer): PayRoll {
  let state = borsh.deserialize(
    PayrollSchema,
    PayRoll,
    data
  );
  return state;
}
