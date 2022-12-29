import {Keypair, LAMPORTS_PER_SOL, Connection, PublicKey} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as BufferLayout from "buffer-layout";
import BN from 'bn.js';

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
  destinationWallet: Keypair, 
  amount: number
) {
  const airdropSignature = await connection.requestAirdrop(destinationWallet.publicKey, 
    amount * LAMPORTS_PER_SOL);

  const latestBlockHash = await connection.getLatestBlockhash();

  const tx = await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature
  });
}