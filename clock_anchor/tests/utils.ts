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


// stakingPoolPDA
export const getConfigPDA = async(program)
    : Promise<[anchor.web3.PublicKey, number]> => {

    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("config"))],
        program.programId
    );

    return [pda, bump];
}

// campaignPDA
export const getCampaignPDA = async(program, fundstarterAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("campaign")),
        fundstarterAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}  

  // vaultPDA
export const getVaultPDA = async(program, campaignAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
        campaignAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}
  

  // roundPDA
export const getRoundPDA = async(program, campaignAddress: anchor.web3.PublicKey, number: number)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;
    
    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("round")),
        campaignAddress.toBuffer(), new anchor.BN(number).toBuffer('le', 8)],
        program.programId
    );

    return [pda, bump];
}
 

// roundVotesPDA
export const getRoundVotesPDA = async(program, roundAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("voting")),
        roundAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}


// donatorAccountPDA
export const getDonatorAccountPDA = async(program, roundAddress: anchor.web3.PublicKey, donatorAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("donator")),
        roundAddress.toBuffer(), donatorAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}
 

// moderatorAccountPDA
export const getModeratorAccountPDA = async(program, campaignAddress: anchor.web3.PublicKey, userAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("moderator")),
        campaignAddress.toBuffer(), userAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}
  

// stakingPoolPDA
export const getStakingPoolPDA = async(program, configAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("staking-pool")),
        configAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}
  

// stakeAccountPDA
export const getStakeAccountPDA = async(program, stakerAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("staker")),
        stakerAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
}
  

  // voterAccountPDA
export const getVoterAccountPDA = async(program, roundAddress: anchor.web3.PublicKey, userAddress: anchor.web3.PublicKey)
: Promise<[anchor.web3.PublicKey, number]> => {
    let pda: anchor.web3.PublicKey;
    let bump: number;

    [pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("voter")),
        roundAddress.toBuffer(),userAddress.toBuffer()],
        program.programId
    );

    return [pda, bump];
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
