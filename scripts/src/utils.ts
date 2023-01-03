import {Keypair, LAMPORTS_PER_SOL, Connection, PublicKey} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as spl from '@solana/spl-token';

const PROVIDER_KEYPAIR_PATH = "/home/ademola/.config/solana/id.json";
const PROGRAM_KEYPAIR_PATH = path.resolve(__dirname, '../../program/target/deploy/program-keypair.json');

export function getProviderKeypair(): Keypair {
  try {
    return createKeypairFromFile(PROVIDER_KEYPAIR_PATH);
  } catch(err) {
    console.warn("Failed getting provider keypair");
  }
} 

export function getProgramKeypair(): Keypair {
  try {
    return createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
  } catch(err) {
    console.warn("Failed getting program keypair");
  }
}

export function createKeypairFromFile(
  filePath: string
): Keypair {
  const secretKeyString = fs.readFileSync(filePath, {encoding: 'utf8'});
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

export async function airdrop(
  connection: Connection, 
  destinationWallet: PublicKey, 
  amount: number
) {
  const airdropSignature = await connection.requestAirdrop(destinationWallet, 
    amount * LAMPORTS_PER_SOL);

  const latestBlockHash = await connection.getLatestBlockhash();

  const tx = await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature
  });
}

export async function createTokenMint(connection: Connection, mintAuthority: Keypair): Promise<[PublicKey, Keypair]> {
  let mintAddress = await spl.createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    0
  );
  console.log(`Mint account created with address: ${mintAddress.toBase58()}`);

  return [mintAddress, mintAuthority]
}


export const mintTokensToWallet = async(wallet: PublicKey, amount: number, feePayer: Keypair, 
  mintAddress: PublicKey, mintAuthority: Keypair, connection: Connection) => {
  let tx = await spl.mintToChecked(
      connection,
      feePayer,
      mintAddress,
      wallet,
      mintAuthority,
      amount * 1e0,
      0
  );

  console.log(`Minted ${amount} tokens to ${wallet}`);
}

