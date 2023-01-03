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
  serializeNewPayrollArgs,
  deserializeAccountingState,
  deserializePayrollState,
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
  let initializerTokenAccount: PublicKey;
  let accountingPDA: PublicKey;
  let accountingBump: number;
  let vaultKey: PublicKey;

  let threadProgram = new PublicKey("3XXuUFfweXBwFgFfYaejLvZE4cGZiHgKiGfMtdxNzYmv");

  it("Initializes an accounting instance", async () => {
    mintAuthority = new Keypair();
    await airdrop(connection, mintAuthority.publicKey, 1);
    [tokenX, tokenXAuthority] = await createTokenMint(connection, mintAuthority);

    initializer = new Keypair();
    await airdrop(connection, initializer.publicKey, 1);

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
    assert.equal(deserializedInfo.activePayrolls.toNumber(), 0);
    assert.ok(new PublicKey(deserializedInfo.vault).equals(vaultKey));
    assert.equal(deserializedInfo.balance.toNumber(), 0);
    assert.ok(deserializedInfo.active == true);
    assert.equal(deserializedInfo.bump, accountingBump);
  });

  it("Deposits to accounting vault", async () => {
    initializerTokenAccount = await spl.createAssociatedTokenAccount(
      connection, initializer, tokenX, initializer.publicKey);

    await mintTokensToWallet(initializerTokenAccount, 2500, mintAuthority, tokenX, tokenXAuthority, connection);

    let depositAmount = new BN(2000);
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
        },
      ],
      data: instructionData
    });

    let tx = new Transaction().add(depositInstruction);
    console.log("Sending instruction to deposit into vault");
    await sendAndConfirmTransaction(connection, tx, [initializer]);

    let vaultInfo = await spl.getAccount(connection, vaultKey);
    assert.equal(Number(vaultInfo.amount), depositAmount.toNumber());
  });

  it("Creates a new payroll and simulates payment", async() => {
    let recv1 = Keypair.generate();
    let payroll1 = await newPayroll(recv1, new BN(50), new BN(3), "*/10 * * * * * *");

    let recv2 = Keypair.generate();
    let payroll2 = await newPayroll(recv2, new BN(20), new BN(5), "*/10 * * * * * *");

    let recv3 = Keypair.generate();
    let payroll3 = await newPayroll(recv3, new BN(20), new BN(10), "*/10 * * * * * *");

    let recvWallet1 = await initPayment(recv1, payroll1);
    let recvWallet2 = await initPayment(recv2, payroll2);
    let recvWallet3 = await initPayment(recv3, payroll3);

    const sleep = (milliseconds) => new Promise(r => setTimeout(r, milliseconds));
    for (let i = 0; i < 3; ++i) {
      console.log(`Ran ${i} time(s)`);
      let vaultInfo = await connection.getTokenAccountBalance(vaultKey);
      let recvA = await connection.getTokenAccountBalance(recvWallet1);
      let recvB = await connection.getTokenAccountBalance(recvWallet2);
      let recvC = await connection.getTokenAccountBalance(recvWallet3);

      console.log("   Vault balance: ", vaultInfo.value.uiAmount);
      console.log("   Receiver 1 balance: ", recvA.value.uiAmount);
      console.log("   Receiver 2 balance: ", recvB.value.uiAmount);
      console.log("   Receiver 3 balance: ", recvC.value.uiAmount);
      console.log("sleeping...");
      await sleep(10000);  
    }

    async function newPayroll(
      receiver: Keypair,
      amount: BN,
      cycles: BN,
      schedule: string,
    ): Promise<PublicKey> {
      await airdrop(connection, receiver.publicKey, 2);
      let [payroll, bump] = PublicKey.findProgramAddressSync([
        Buffer.from("payroll", "utf8"), accountingPDA.toBuffer(), 
        receiver.publicKey.toBuffer()], programId
      );
      
      let encodedArgs = serializeNewPayrollArgs(amount, cycles, schedule);
      let instructionData = Buffer.from([2]);
      instructionData = Buffer.concat([instructionData, Buffer.from(encodedArgs)]);

      let ix = new TransactionInstruction({
        programId: programId,
        keys: [
          {
            pubkey: initializer.publicKey,
            isWritable: true,
            isSigner: true,
          },
          {
            pubkey: accountingPDA,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: payroll,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: receiver.publicKey,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: SystemProgram.programId,
            isWritable: false,
            isSigner: false,
          }
        ],
        data: instructionData,
      });

      let tx = new Transaction().add(ix);
      console.log("Sending tx to create new payroll");
      await sendAndConfirmTransaction(connection, tx, [initializer]);

      let payrollInfo = await connection.getAccountInfo(payroll);
      let payrollState = deserializePayrollState(payrollInfo.data);

      assert.ok(payrollState.accounting.equals(accountingPDA));
      assert.ok(payrollState.active == false);
      assert.ok(payrollState.amount.toNumber() == amount.toNumber());
      assert.ok(payrollState.totalAmountDisbursed.toNumber() == 0);
      assert.equal(payrollState.cronSchedule, schedule);
      assert.ok(payrollState.receiver.equals(receiver.publicKey));
      assert.ok(payrollState.maxCycles.toNumber() == cycles.toNumber());
      assert.ok(payrollState.bump == bump);

      return payroll;
    }

    async function initPayment(receiver: Keypair, payroll: PublicKey): Promise<PublicKey> {
      let accountingInfo = await connection.getAccountInfo(accountingPDA);
      let deserializedInfo = deserializeAccountingState(accountingInfo.data);
      let initialPayrolls = deserializedInfo.activePayrolls;

      let receiverWallet = await spl.createAssociatedTokenAccount(
        connection, receiver, tokenX, receiver.publicKey);
      let threadId = receiver.publicKey.toString().slice(0, 10);

      let [thread, _] = await PublicKey.findProgramAddressSync(
        [Buffer.from("thread", "utf8"), payroll.toBuffer(), 
        Buffer.from(threadId, "utf8")], threadProgram
      );
      console.log("   ThreadId: ", threadId);
      console.log("   Thread key: ", thread.toString());
      console.log("   Payroll: ", payroll.toString());
      await airdrop(connection, thread, 10);

      let ix = new TransactionInstruction({
        programId: programId,
        keys: [
          {
            pubkey: initializer.publicKey,
            isWritable: false,
            isSigner: true,
          },
          {
            pubkey: accountingPDA,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: payroll,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: vaultKey,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: receiverWallet,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: thread,
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: threadProgram,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: spl.TOKEN_PROGRAM_ID,
            isWritable: false,
            isSigner: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: Buffer.from([3])
      });

      let tx = new Transaction().add(ix);
      console.log("Sending tx to initialize payment");
      await sendAndConfirmTransaction(connection, tx, [initializer]);

      accountingInfo = await connection.getAccountInfo(accountingPDA);
      deserializedInfo = deserializeAccountingState(accountingInfo.data);
      let afterPayrolls = deserializedInfo.activePayrolls;

      assert.equal(initialPayrolls.toNumber() + 1, afterPayrolls.toNumber());

      let payrollInfo = await connection.getAccountInfo(payroll);
      let payrollState = deserializePayrollState(payrollInfo.data);
      assert.ok(payrollState.active == true);
      assert.ok(payrollState.thread.equals(thread));

      return receiverWallet;
    }

  });
});

