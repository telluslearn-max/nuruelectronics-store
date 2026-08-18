// Proves the last untested link in Capital Circle's live path: that the real Circle mainnet
// wallet's signer can authenticate with Polymarket's CLOB and receive API credentials back.
// No funds needed and none move — deriving/creating an API key only requires a valid signature
// over Polymarket's own auth message, not a funded wallet. This does NOT place an order; it only
// proves the handshake executor-tool.ts's live path depends on actually works.
//
// Usage:
//   DOTENV_CONFIG_PATH=.env.local npx tsx -r ./scripts/mock-server-only.cjs scripts/verify-circle-clob-auth.ts
import "dotenv/config";
import { Chain, ClobClient } from "@polymarket/clob-client-v2";
import { getClobSigner, circleWalletAddress } from "../src/lib/capital-circle/circle-wallet-client";

const CLOB_HOST = "https://clob.polymarket.com";

async function main() {
  console.log("Wallet address:", circleWalletAddress);
  console.log("Deriving/creating a Polymarket API key via the real Circle wallet signer (no order placed, no funds needed)...");

  const signer = getClobSigner();
  const authClient = new ClobClient({ host: CLOB_HOST, chain: Chain.POLYGON, signer, throwOnError: true });

  const creds = await authClient.createOrDeriveApiKey();
  console.log("\n✅ PASSED — Polymarket accepted the Circle wallet's signature and issued API credentials:");
  console.log({ apiKey: creds.key, hasSecret: Boolean(creds.secret), hasPassphrase: Boolean(creds.passphrase) });
}

main().catch((e) => {
  console.error("\n❌ FAILED —", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
