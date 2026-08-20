import "server-only";
import QRCode from "qrcode";
import { Chain } from "@polymarket/clob-client-v2";
import { COLLATERAL_TOKEN_ADDRESS, isCircleWalletTestnet } from "./circle-wallet-client";

/**
 * EIP-681 chain id, per its `@<chainId>` segment — must track which network the wallet is
 * actually on. Was hardcoded to Polygon mainnet regardless of isCircleWalletTestnet, which is
 * dormant today (mainnet is configured) but would have handed a mainnet-chain QR for a
 * testnet-only collateral token to anyone who flipped CAPITAL_CIRCLE_WALLET_NETWORK=testnet.
 */
const CHAIN_ID = isCircleWalletTestnet ? Chain.AMOY : Chain.POLYGON;

/**
 * EIP-681 token-transfer URI — the same convention Circle's own CLI uses for `wallet fund
 * --method crypto`'s QR code. Wallets that support it (MetaMask mobile, Trust Wallet, etc.)
 * pre-fill both the collateral token and the recipient address; wallets that don't just see an
 * address to scan and fall back to manual token/network selection. Amount is deliberately
 * omitted — deposit sizes vary, so this only ever pre-fills who and what, never how much.
 */
export function usdcDepositUri(walletAddress: string): string {
  return `ethereum:${COLLATERAL_TOKEN_ADDRESS}@${CHAIN_ID}/transfer?address=${walletAddress}`;
}

/** Server-rendered inline SVG — no client JS, no external request, safe to drop straight into a server component. */
export async function walletDepositQrSvg(walletAddress: string): Promise<string> {
  return QRCode.toString(usdcDepositUri(walletAddress), { type: "svg", margin: 1, width: 160 });
}
