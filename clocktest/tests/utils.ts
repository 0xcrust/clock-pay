import * as anchor from '@project-serum/anchor';
import * as spl from '@solana/spl-token';

export const createTokenMint = async (connection: anchor.web3.Connection, mintAuthority: anchor.web3.Keypair)
: Promise<[anchor.web3.PublicKey, anchor.web3.Keypair]>  => {
  
    let mintAddress = await spl.createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      0
    );
    console.log(`Mint account created with address: ${mintAddress.toBase58()}`);
  
    return [mintAddress, mintAuthority];
}


export const airdrop = async (connection, destinationWallet: anchor.web3.PublicKey, amount) => {
    const airdropSignature = await connection.requestAirdrop(destinationWallet,
         amount * anchor.web3.LAMPORTS_PER_SOL);

    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
    console.log(`Airdropped ${amount} sol to ${destinationWallet}!`);
}


export const mintToAccount = async (connection, account, mint,
    mintAuthority, amount) => {
    const wallet = await spl.createAssociatedTokenAccount(
        connection,
        account,
        mint,
        account.publicKey  
      );
    
      let xx = await spl.mintToChecked(
        connection,
        account,
        mint,
        wallet,
        mintAuthority,
        amount * 1e0,
        0
      );

      console.log(`minted ${amount} tokens to ${account}`);
}

export const createAssociatedTokenAccount = async(program, account: anchor.web3.Keypair, mint: anchor.web3.PublicKey)
: Promise<anchor.web3.PublicKey> => {
    const wallet = await spl.createAssociatedTokenAccount(
        program.provider.connection,
        account,
        mint,
        account.publicKey
    );

    console.log("Created Associated Token Account");
    return wallet;
}

export const mintTokensToWallet = async(wallet: anchor.web3.PublicKey, amount: number, feePayer: anchor.web3.Keypair, 
    mintAddress: anchor.web3.PublicKey, mintAuthority: anchor.web3.Keypair, program) => {
    let tx = await spl.mintToChecked(
        program.provider.connection,
        feePayer,
        mintAddress,
        wallet,
        mintAuthority,
        amount * 1e0,
        0
    );

    console.log(`Minted ${amount} tokens to ${wallet}`);
}
