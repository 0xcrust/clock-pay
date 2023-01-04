import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Auto } from "../target/types/auto";
import * as spl from "@solana/spl-token";
import {
  createTokenMint,
  airdrop,
} from "./utils";

describe("auto", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Auto as Program<Auto>;
  const connection = program.provider.connection;

  it("Is initialized!", async () => {
    console.log("Create token mint");
    let minter = anchor.web3.Keypair.generate();
    console.log("   Vault authority: ", minter.publicKey.toString());
    await airdrop(connection, minter.publicKey, 2);
    let [mint, mintAuthority] = await createTokenMint(connection, minter);

    console.log("Initialize vault and vault authority");
    let vault = await spl.createAssociatedTokenAccount(connection, minter, mint, minter.publicKey);
    console.log("   Vault: ", vault.toString());
    await spl.mintToChecked(
      connection,
      mintAuthority,
      mint,
      vault,
      mintAuthority,
      2500 * 1e0,
      0
    );

    console.log("Create initializer")
    let initializer = anchor.web3.Keypair.generate();
    console.log("   Initializer: ", initializer.publicKey.toString());
    await airdrop(connection, initializer.publicKey, 2);

    console.log("Initialize Bursary");
    let [bursary, bursaryBump] = await anchor.web3.PublicKey.findProgramAddressSync([
      Buffer.from(anchor.utils.bytes.utf8.encode("bursary")), initializer.publicKey.toBuffer(), 
      vault.toBuffer()], program.programId);
    console.log("   Bursary: ", bursary.toString());

    let delegatedAmount = new anchor.BN(2000);
    try {
      await program.methods.initBursary(delegatedAmount)
      .accounts({
        initializer: initializer.publicKey,
        vault: vault,
        vaultAuthority: minter.publicKey,
        bursary: bursary,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      }).signers([initializer, minter]).rpc();
    } catch(err) {
      console.log(err);
    }

    let vaultInfo = await spl.getAccount(connection, vault);
    console.log("Checking vault info...:");
    console.log("   VaultInfo: ", vaultInfo);
    console.log("   Delegated: ", vaultInfo.delegatedAmount);
    console.log("   Delegate: ", vaultInfo.delegate);
    
    console.log("Init payment for receiver A");
    let receiverA = anchor.web3.Keypair.generate();
    await airdrop(connection, receiverA.publicKey, 2);
    let receiverAWallet = await spl.createAssociatedTokenAccount(
      connection, receiverA, mint, receiverA.publicKey);
    let amountA = new anchor.BN(20);
    let scheduleA = "*/10 * * * * * *";
    let cyclesA = new anchor.BN(10);
    console.log("   ReceiverA balance: ", receiverA.publicKey.toString());
    console.log("   ReceiverAWallet: ", receiverAWallet.toString());

    console.log("Init payment for receiver B");
    let receiverB = anchor.web3.Keypair.generate();
    await airdrop(connection, receiverB.publicKey, 2);
    let receiverBWallet = await spl.createAssociatedTokenAccount(
      connection, receiverB, mint, receiverB.publicKey);
    let amountB = new anchor.BN(50);
    let scheduleB = "*/10 * * * * * *";
    let cyclesB = new anchor.BN(10);
    console.log("   ReceiverB: ", receiverB.publicKey.toString());
    console.log("   ReceiverBWallet: ", receiverBWallet.toString());

    console.log("Init payment for receiver C");
    let receiverC = anchor.web3.Keypair.generate();
    await airdrop(connection, receiverC.publicKey, 5);
    let receiverCWallet = await spl.createAssociatedTokenAccount(
      connection, receiverC, mint, receiverC.publicKey);
    let amountC = new anchor.BN(30);
    let scheduleC = "*/10 * * * * * *";
    let cyclesC = new anchor.BN(10);
    console.log("   ReceiverC: ", receiverC.publicKey.toString());
    console.log("   ReceiverCWallet: ", receiverCWallet.toString());

    await newPayment(initializer, vault, receiverAWallet, amountA, scheduleA, cyclesA);
    await newPayment(initializer, vault, receiverBWallet, amountB, scheduleB, cyclesB);
    await newPayment(initializer, vault, receiverCWallet, amountC, scheduleC, cyclesC);

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < 10; ++i) {
      console.log(`Ran ${i} time(s)`);
      let vaultInfo = await program.provider.connection.getTokenAccountBalance(vault);
      let recvA = await program.provider.connection.getTokenAccountBalance(receiverAWallet);
      let recvB = await program.provider.connection.getTokenAccountBalance(receiverBWallet);
      let recvC = await program.provider.connection.getTokenAccountBalance(receiverCWallet);

      console.log("   Vault balance: ", vaultInfo.value.uiAmount);
      console.log("   Receiver A balance: ", recvA.value.uiAmount);
      console.log("   Receiver B balance: ", recvB.value.uiAmount);
      console.log("   Receiver C balance: ", recvC.value.uiAmount);
      console.log("sleeping...");
      await sleep(10000);
    }

    let vaultBalance = await (await program.provider.connection.getTokenAccountBalance(vault)).value.uiAmount;
    let recvABalance = await (await program.provider.connection.getTokenAccountBalance(receiverAWallet)).value.uiAmount;
    let recvBBalance = await (await program.provider.connection.getTokenAccountBalance(receiverBWallet)).value.uiAmount;
    let recvCBalance = await (await program.provider.connection.getTokenAccountBalance(receiverCWallet)).value.uiAmount;

    console.log("Final Vault balance: ", vaultBalance);
    console.log("Final Receiver A balance: ", recvABalance);
    console.log('Final Receiver B balance: ', recvBBalance);
    console.log('Final Receiver C balance: ', recvCBalance);

    async function newPayment(
      initializer: anchor.web3.Keypair,
      vault: anchor.web3.PublicKey,
      receiverWallet: anchor.web3.PublicKey,
      amount: anchor.BN,
      schedule: string,
      cycles: anchor.BN
    ) {  
      console.log("New payment");
      console.log("   Generate pay instance");
      let [payInstance, bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("pay")),
        bursary.toBuffer(), receiverWallet.toBuffer() ], program.programId
      );
      console.log("   Pay instance: ", payInstance.toString());
  
      console.log("Generate thread...:");
      let threadProgram = new anchor.web3.PublicKey("3XXuUFfweXBwFgFfYaejLvZE4cGZiHgKiGfMtdxNzYmv");
      let threadId = receiverWallet.toString().slice(0, 10);
      let [thread, _] = await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("thread")), payInstance.toBuffer(), 
        Buffer.from(anchor.utils.bytes.utf8.encode(threadId))], threadProgram
      );
      console.log("   ThreadId: ", threadId);
      console.log("   Thread key: ", thread.toString());
      await airdrop(connection, thread, 5);
  
      console.log("Initializing new payment...:");
      console.log("   amount: ", amount.toNumber());
      console.log("   schedule: ", schedule);
      console.log("   cycles: ", cycles.toNumber());
      try {
        await program.methods
          .initPay(amount, schedule, cycles)
          .accounts({
            authority: initializer.publicKey,
            bursary: bursary,
            vault: vault,
            payInstance: payInstance,
            receiverWallet: receiverWallet,
            thread: thread,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
            threadProgram: threadProgram,
          })
          .signers([initializer]).rpc();
      } catch(err) {
        console.log(err);
      }
    }

  });
});
