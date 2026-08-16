// One-time Capital Circle provisioning script — run this yourself, locally,
// with your own mainnet Circle API key. Never run this inside a shared
// session: it generates and registers your Entity Secret, which must stay
// as secret as a private key (see @circle-fin/developer-controlled-wallets'
// own README warning).
//
// What it does, per Circle's official Developer-Controlled Wallets flow:
//   1. Generates a new Entity Secret and prints it (also copy it somewhere
//      safe immediately — this is the only time it's shown).
//   2. Registers it with Circle using your API key (downloads a recovery
//      file — store that securely too, same as the secret itself).
//   3. Creates a wallet set, then one Polygon mainnet wallet inside it.
//   4. Prints the four values that go into .env.local / Vercel's env vars:
//      CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS.
//
// After this, follow the plan doc's remaining Phase B steps (circle wallet
// limit set for spending caps, contract-allowlist, funding) — this script
// only gets you a wallet to point those at.
//
// Usage: CIRCLE_API_KEY=<your-mainnet-api-key> node scripts/circle-wallet-setup.mjs
import "dotenv/config";
import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("Set CIRCLE_API_KEY (your mainnet key from console.circle.com) before running this.");
  process.exit(1);
}

console.log("Generating a new Entity Secret — copy this line somewhere safe right now:\n");
generateEntitySecret();

console.log(
  "\nPaste the Entity Secret printed above as ENTITY_SECRET and re-run:\n" +
    "  CIRCLE_API_KEY=... ENTITY_SECRET=... node scripts/circle-wallet-setup.mjs --register\n",
);

const entitySecret = process.env.ENTITY_SECRET;
if (!entitySecret || !process.argv.includes("--register")) {
  process.exit(0);
}

const registerResponse = await registerEntitySecretCiphertext({ apiKey, entitySecret });
console.log("Registered. Recovery file contents (store this securely too):");
console.log(JSON.stringify(registerResponse.data?.recoveryFile, null, 2));

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const walletSetResponse = await client.createWalletSet({ name: "Capital Circle" });
const walletSetId = walletSetResponse.data?.walletSet?.id;
console.log("\nCreated wallet set:", walletSetId);

const walletsResponse = await client.createWallets({
  blockchains: ["MATIC"], // Polygon mainnet — see plan doc on why Polymarket needs this specific chain.
  count: 1,
  walletSetId: walletSetId ?? "",
});
const wallet = walletsResponse.data?.wallets?.[0];

console.log("\nCreated wallet — put these in .env.local and Vercel's env vars:\n");
console.log(`CIRCLE_API_KEY=${apiKey}`);
console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
console.log(`CIRCLE_WALLET_ID=${wallet?.id ?? "<missing — check the response above>"}`);
console.log(`CIRCLE_WALLET_ADDRESS=${wallet?.address ?? "<missing — check the response above>"}`);
console.log(
  "\nNext: set spending-policy caps and the Polymarket contract-allowlist with the Circle CLI " +
    "(circle wallet limit set — see the plan doc), then fund the wallet.",
);
