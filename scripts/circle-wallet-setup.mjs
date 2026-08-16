// One-time provisioning for the Capital Circle's Circle Agent Wallet.
//
// SECURITY: run this on your own machine, never in a shared/remote session —
// it generates and registers your Entity Secret, the single credential that
// can move real money out of this wallet. Never paste the secret it prints,
// or the recovery file it downloads, anywhere but your own secrets manager.
//
// Pass --testnet to every command to do a free, zero-risk dry run first
// (Polygon Amoy testnet instead of mainnet, a separate API key). This can
// prove wallet creation, the Entity Secret flow, and signing all work — it
// CANNOT prove the spending-policy circuit breaker works, because Circle's
// own CLI docs say wallet spending limits require a mainnet wallet, testnet
// isn't supported for that specific feature. Treat a testnet run as "does
// the plumbing work," not a substitute for the real (tiny-capped) mainnet
// wallet before anything trades for real.
//
// Usage, in order (see the plan doc's Phase B checklist for context):
//   node scripts/circle-wallet-setup.mjs generate-secret [--testnet]
//     -> prints a new Entity Secret. Copy it now; it is never shown again.
//   node scripts/circle-wallet-setup.mjs register --entity-secret <secret> [--testnet]
//     -> registers it with Circle, downloads a recovery file into this
//        directory. Move that file somewhere safe immediately.
//   node scripts/circle-wallet-setup.mjs create-wallet --entity-secret <secret> [--testnet]
//     -> creates a wallet set + one wallet (MATIC, or MATIC-AMOY with
//        --testnet), prints the id/address to save as env vars.
//
// Requires CIRCLE_API_KEY in .env.local for mainnet runs (the mainnet key —
// see the console's environment selector), or CIRCLE_TESTNET_API_KEY for
// --testnet runs (a separate key — testnet and mainnet keys are not
// interchangeable). Set CIRCLE_ENTITY_SECRET too once you have it, alongside
// CIRCLE_WALLET_ID/CIRCLE_WALLET_ADDRESS from the last step.
import "dotenv/config";
import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const command = process.argv[2];
const isTestnet = process.argv.includes("--testnet");
const apiKey = isTestnet ? process.env.CIRCLE_TESTNET_API_KEY : process.env.CIRCLE_API_KEY;
const label = isTestnet ? "[testnet]" : "[mainnet]";

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (!apiKey) {
  console.error(
    isTestnet
      ? "Set CIRCLE_TESTNET_API_KEY in .env.local first (a separate testnet key from console.circle.com)."
      : "Set CIRCLE_API_KEY in .env.local first (the mainnet key).",
  );
  process.exit(1);
}

if (command === "generate-secret") {
  console.log(`${label} Generating a new Entity Secret — copy it now, it will not be shown again:\n`);
  generateEntitySecret();
} else if (command === "register") {
  const entitySecret = flag("entity-secret");
  if (!entitySecret) {
    console.error("Usage: node scripts/circle-wallet-setup.mjs register --entity-secret <secret> [--testnet]");
    process.exit(1);
  }
  await registerEntitySecretCiphertext({ apiKey, entitySecret });
  console.log(`${label} Registered. Recovery file downloaded to this directory — move it somewhere safe now.`);
} else if (command === "create-wallet") {
  const entitySecret = flag("entity-secret");
  if (!entitySecret) {
    console.error("Usage: node scripts/circle-wallet-setup.mjs create-wallet --entity-secret <secret> [--testnet]");
    process.exit(1);
  }
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletSet = await client.createWalletSet({ name: isTestnet ? "Capital Circle (testnet)" : "Capital Circle" });
  const walletSetId = walletSet.data?.walletSet?.id;
  console.log(`${label} Created wallet set:`, walletSetId);

  const blockchain = isTestnet ? "MATIC-AMOY" : "MATIC";
  const wallets = await client.createWallets({ blockchains: [blockchain], count: 1, walletSetId });
  const wallet = wallets.data?.wallets?.[0];
  console.log(`\n${label} Created wallet on ${blockchain} — save these as env vars${isTestnet ? " (a scratch .env, not the real ones)" : ""}:`);
  console.log(isTestnet ? "CIRCLE_TESTNET_WALLET_ID=" : "CIRCLE_WALLET_ID=", wallet?.id);
  console.log(isTestnet ? "CIRCLE_TESTNET_WALLET_ADDRESS=" : "CIRCLE_WALLET_ADDRESS=", wallet?.address);
  console.log(
    isTestnet
      ? "\nThis proves wallet creation + signing work. It can't test spending-policy caps (mainnet only) or real " +
          "Polymarket markets. When ready for real, run this again without --testnet."
      : "\nNext: fund this address with USDC on Polygon, then set the spending policy with the Circle CLI " +
          "(circle wallet limit set — see the plan doc's Phase B step 4) before CAPITAL_CIRCLE_LIVE=true.",
  );
} else {
  console.log("Usage: node scripts/circle-wallet-setup.mjs <generate-secret|register|create-wallet> [--entity-secret <secret>] [--testnet]");
  process.exit(1);
}
