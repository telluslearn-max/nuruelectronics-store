import "server-only";
import QRCode from "qrcode";

/** Polygon mainnet chain id, per EIP-681's `@<chainId>` segment. */
const POLYGON_CHAIN_ID = 137;

/** Circle's own USDC contract address on Polygon — from `circle contract address usdc --chain MATIC`. */
export const USDC_POLYGON_CONTRACT = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

/**
 * EIP-681 token-transfer URI — the same convention Circle's own CLI uses for `wallet fund
 * --method crypto`'s QR code. Wallets that support it (MetaMask mobile, Trust Wallet, etc.)
 * pre-fill both the USDC token and the recipient address; wallets that don't just see an
 * address to scan and fall back to manual token/network selection. Amount is deliberately
 * omitted — deposit sizes vary, so this only ever pre-fills who and what, never how much.
 */
export function usdcDepositUri(walletAddress: string): string {
  return `ethereum:${USDC_POLYGON_CONTRACT}@${POLYGON_CHAIN_ID}/transfer?address=${walletAddress}`;
}

/** Server-rendered inline SVG — no client JS, no external request, safe to drop straight into a server component. */
export async function walletDepositQrSvg(walletAddress: string): Promise<string> {
  return QRCode.toString(usdcDepositUri(walletAddress), { type: "svg", margin: 1, width: 160 });
}
