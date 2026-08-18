// Proves the Circle testnet wallet plumbing actually works end-to-end: fetches its USDC
// balance and produces an EIP-712 signature, then independently verifies that signature
// recovers to the wallet's own address using viem (not Circle's SDK) — so a bug in our
// typed-data construction can't hide behind Circle's API just accepting whatever we send.
//
// Zero risk: testnet only, no mainnet key touched, no funds involved.
//
// Usage:
//   CAPITAL_CIRCLE_WALLET_NETWORK=testnet npx tsx scripts/verify-circle-testnet-wallet.ts
import "dotenv/config";
import { verifyTypedData } from "viem";
import {
  isCircleWalletConfigured,
  isCircleWalletTestnet,
  circleWalletAddress,
  getBalanceUsdc,
  getClobSigner,
} from "../src/lib/capital-circle/circle-wallet-client";

async function main() {
  console.log(`Testnet mode: ${isCircleWalletTestnet}`);
  console.log(`Wallet configured: ${isCircleWalletConfigured}`);
  console.log(`Wallet address: ${circleWalletAddress ?? "none"}`);

  if (!isCircleWalletTestnet) {
    console.error(
      "\nSet CAPITAL_CIRCLE_WALLET_NETWORK=testnet before running this — refusing to run " +
        "against mainnet vars from a verification script.",
    );
    process.exit(1);
  }
  if (!isCircleWalletConfigured) {
    console.error(
      "\nCircle testnet wallet isn't configured — check CIRCLE_TESTNET_API_KEY/ENTITY_SECRET/" +
        "WALLET_ID/WALLET_ADDRESS in .env.local.",
    );
    process.exit(1);
  }

  console.log("\n--- Test 1: fetch USDC balance ---");
  const balance = await getBalanceUsdc();
  console.log(`USDC balance: ${balance} (0 is expected — this wallet has never been funded)`);

  console.log("\n--- Test 2: EIP-712 signTypedData + independent recovery ---");
  const domain = {
    name: "Capital Circle Verification",
    version: "1",
    chainId: 80002, // Polygon Amoy
    verifyingContract: "0x0000000000000000000000000000000000000000" as const,
  };
  const types = {
    Ping: [
      { name: "message", type: "string" },
      { name: "nonce", type: "uint256" },
    ],
  };
  const message = { message: "capital-circle-testnet-check", nonce: BigInt(Date.now()) };

  const signer = getClobSigner();
  const signature = (await signer._signTypedData(domain, types, {
    ...message,
    nonce: message.nonce.toString(),
  })) as `0x${string}`;
  console.log(`Signature: ${signature}`);

  const recovered = await verifyTypedData({
    address: circleWalletAddress as `0x${string}`,
    domain,
    types,
    primaryType: "Ping",
    message,
    signature,
  });

  console.log(`Signature recovers to wallet address: ${recovered}`);

  if (!recovered) {
    console.error("\n❌ FAILED — the signature does not recover to the wallet's own address.");
    process.exit(1);
  }
  console.log("\n✅ PASSED — Circle wallet signing is verified end-to-end on testnet.");
}

main().catch((err) => {
  console.error("\n❌ FAILED —", err instanceof Error ? err.message : err);
  process.exit(1);
});
