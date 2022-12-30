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


class StartPayArgs {
  timeTillStart = new BN(0);
  amount = new BN(0);
  cycles = new BN(0);
  interval = new BN(0);
  receiverKey = PublicKey.default;
  constructor (fields: {
    timeTillStart: BN, amount: BN, cycles: BN, interval: BN, 
    receiverKey: PublicKey} | undefined = undefined) {
      if (fields) {
        this.timeTillStart = fields.timeTillStart;
        this.amount = fields.amount;
        this.cycles = fields.cycles;
        this.interval = fields.interval;
        this.receiverKey = fields.receiverKey;
      }
    }
}

const StartPaySchema = new Map([
  [
    StartPayArgs, 
    {
      kind: 'struct', 
      fields: [
        ['time_till_start', 'u64'],
        ['amount', 'u64'],
        ['cycles', 'u64'],
        ['interval', 'u64'],
        ['receiver_key', [32]]
      ]
    }
  ]
]);

export function serializeStartPayArgs(
  time: BN, amount: BN, cycles: BN, interval: BN, receiverKey: PublicKey
): Uint8Array {
  const args = borsh.serialize(
    StartPaySchema,
    new StartPayArgs({
      timeTillStart: time,
      amount: amount,
      cycles: cycles,
      interval: interval,
      receiverKey: receiverKey,
    }),
  );
  return args;
}


export class AccountingState {
  authority = PublicKey.default;
  mint = PublicKey.default;
  active_payrolls = new BN(0);
  vault = PublicKey.default;
  balance = new BN(0);
  bump = 0;
  constructor(fields: {
    authority: PublicKey, mint: PublicKey, active_payrolls: BN, 
    vault: PublicKey, balance: BN, bump: number
  } | undefined = undefined) {
    if (fields) {
      this.authority = fields.authority;
      this.mint = fields.mint;
      this.active_payrolls = fields.active_payrolls,
      this.vault = fields.vault;
      this.balance = fields.balance;
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
        ['bump', 'u8']
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

