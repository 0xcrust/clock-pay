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
  [DepositArgs, {kind: 'struct', fields: [['amount', 'u64'],]}],
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
        ['receiver_key', '[32]']
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