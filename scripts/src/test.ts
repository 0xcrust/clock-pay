import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import {
  getProviderKeypair,
  getProgramKeypair,
  airdrop,
} from './utils';
import {assert, config, expect} from 'chai';
import BN from "bn.js";

describe("crowdfunding", () => {
  const providerKeypair: Keypair = getProviderKeypair();
  const programKeypair: Keypair =  getProgramKeypair();

  const programId = programKeypair.publicKey;
  const connection = new Connection("http://localhost:8899", "confirmed");

  it("Is initialized!", async () => {
    
  });
});

