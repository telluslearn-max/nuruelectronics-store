// One-time provisioning for the Capital Circle's Circle Agent Wallet.
//
// SECURITY: run this on your own machine, never in a shared/remote session —
// it generates and registers your Entity Secret, the single credential that
// can move real money out of this wallet. Never paste the secret it prints,
// or the recovery file it downloads, anywhere but your own secrets manager.
//
// Usage, in order (see the plan doc's Phase B checklist for context):
//   node scripts/circle-wallet-setup.mjs generate-secret
//     -> prints a new Entity Secret. Copy it now; it is never shown again.
//   node scripts/circle-wallet-setup.mjs register --entity-secret <secret>
//     -> registers it with Circle, downloads a recovery file into this
//        directory. Move that file somewhere safe immediately.
//   node scripts/circle-wallet-setup.mjs create-wallet --entity-secret <secret>
//     -> creates a wallet set + one MATIC (Polygon mainnet) wallet, prints
//        the id/address to save as CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS.
//
// Requires CIRCLE_API_KEY in .env.local (the mainnet key — see the console's
// environment selector). Set CIRCLE_ENTITY_SECRET there too once you have it,
// alongside CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS from the last step.
import "dotenv/config";
import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const command = process.argv[2];

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (!apiKey) {
  console.error("Set CIRCLE_API_KEY in .env.local first (the mainnet key).");
  process.exit(1);
}

if (command === "generate-secret") {
  console.log("Generating a new Entity Secret — copy it now, it will not be shown again:\n");
  generateEntitySecret();
} else if (command === "register") {
  const entitySecret = flag("entity-secret");
  if (!entitySecret) {
    console.error("Usage: node scripts/circle-wallet-setup.mjs register --entity-secret <secret>");
    process.exit(1);
  }
  const response = await registerEntitySecretCiphertext({ apiKey, entitySecret });
  console.log("Registered. Recovery file downloaded to this directory — move it somewhere safe now.");
  console.log(response.data?.recoveryFile ? "Recovery file content also printed above by the SDK." : "");
} else if (command === "create-wallet") {
  const entitySecret = flag("entity-secret");
  if (!entitySecret) {
    console.error("Usage: node scripts/circle-wallet-setup.mjs create-wallet --entity-secret <secret>");
    process.exit(1);
  }
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletSet = await client.createWalletSet({ name: "Capital Circle" });
  const walletSetId = walletSet.data?.walletSet?.id;
  console.log("Created wallet set:", walletSetId);

  const wallets = await client.createWallets({ blockchains: ["MATIC"], count: 1, walletSetId });
  const wallet = wallets.data?.wallets?.[0];
  console.log("\nCreated wallet — save these as env vars:");
  console.log("CIRCLE_WALLET_ID=", wallet?.id);
  console.log("CIRCLE_WALLET_ADDRESS=", wallet?.address);
  console.log(
    "\nNext: fund this address with USDC on Polygon, then set the spending policy with the Circle CLI " +
      "(circle wallet limit set — see the plan doc's Phase B step 4) before CAPITAL_CIRCLE_LIVE=true.",
  );
} else {
  console.log("Usage: node scripts/circle-wallet-setup.mjs <generate-secret|register|create-wallet> [--entity-secret <secret>]");
  process.exit(1);
}
