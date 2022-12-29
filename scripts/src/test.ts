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
  createTokenMint,
  mintTokensToWallet,
} from './utils';
import {
  serializeDepositArgs,
  serializeStartPayArgs

} from './serde';
import {assert, config, expect} from 'chai';
import BN from "bn.js";
import * as spl from "@solana/spl-token";
import { createInitializeNonTransferableMintInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

describe("crowdfunding", () => {
  const programKeypair: Keypair =  getProgramKeypair();

  const programId = programKeypair.publicKey;
  const connection = new Connection("http://localhost:8899", "confirmed");

  let mintAuthority: Keypair;
  let tokenX: PublicKey;
  let tokenXAuthority: Keypair;

  let initializer: Keypair;
  let accountingPDA: PublicKey;
  let accountingBump: number;
  let vaultKey: PublicKey;

  it("Is initialized!", async () => {
    mintAuthority = new Keypair();
    await airdrop(connection, mintAuthority, 1);
    [tokenX, tokenXAuthority] = await createTokenMint(connection, mintAuthority);

    initializer = new Keypair();
    await airdrop(connection, initializer, 1);

    [accountingPDA, accountingBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("accounting", "utf8"), initializer.publicKey.toBuffer()],
      programId
    );
    console.log("accounting:",  accountingPDA);
    vaultKey = await spl.getAssociatedTokenAddress(tokenX, accountingPDA, true);
    console.log("vault: ", vaultKey);
    
    const initAccountingTx = new TransactionInstruction({
      programId: programId,
      keys: [
        {
          pubkey: initializer.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: tokenX,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: accountingPDA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: vaultKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: spl.TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        }
      ],
      data: Buffer.from([0])
    });
    let tx = new Transaction().add(initAccountingTx);
    console.log("Sending initialize accounting transaction");
    await sendAndConfirmTransaction(connection, tx, [initializer]);


    
  });
});

