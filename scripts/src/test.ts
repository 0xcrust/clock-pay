import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  getProgramKeypair,
  airdrop,
  createTokenMint,
  mintTokensToWallet,
} from './utils';
import {
  serializeDepositArgs,
  serializeStartPayArgs,
  deserializeAccountingState,
} from './borsh';
import {assert} from 'chai';
import BN from "bn.js";
import * as spl from "@solana/spl-token";


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
    console.log("accounting:",  accountingPDA.toString());
    vaultKey = await spl.getAssociatedTokenAddress(tokenX, accountingPDA, true);
    console.log("vault: ", vaultKey.toString());
    
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

    let accountingInfo = await connection.getAccountInfo(accountingPDA);
    let deserializedInfo = deserializeAccountingState(accountingInfo.data);

    assert.ok(new PublicKey(deserializedInfo.authority).equals(initializer.publicKey));
    assert.ok(new PublicKey(deserializedInfo.mint).equals(tokenX));
    assert.equal(deserializedInfo.active_payrolls.toNumber(), 0);
    assert.ok(new PublicKey(deserializedInfo.vault).equals(vaultKey));
    assert.equal(deserializedInfo.balance.toNumber(), 0);
    assert.equal(deserializedInfo.bump, accountingBump);

    let initializerTokenAccount = await spl.createAssociatedTokenAccount(
      connection, initializer, tokenX, initializer.publicKey);

    await mintTokensToWallet(initializerTokenAccount, 500, mintAuthority, tokenX, mintAuthority, connection);

    let depositAmount = new BN(400);
    let encodedArgs = serializeDepositArgs(depositAmount);
    let instructionData = Buffer.from([1]);
    instructionData = Buffer.concat([instructionData, Buffer.from(encodedArgs)]);

    let depositInstruction = new TransactionInstruction({
      programId: programId,
      keys: [
        {
          pubkey: initializer.publicKey,
          isSigner: true,
          isWritable: false
        },
        {
          pubkey: accountingPDA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: initializerTokenAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: vaultKey,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: spl.TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        }
      ],
      data: instructionData
    });

    tx = new Transaction().add(depositInstruction);
    console.log("Sending instruction to deposit into vault");
    await sendAndConfirmTransaction(connection, tx, [initializer]);

    let vaultInfo = await spl.getAccount(connection, vaultKey);
    let amount = Number(vaultInfo.amount);
    console.log("amount: ", amount);
    assert.equal(amount, 400);
  });
});

