import "server-only";
import QRCode from "qrcode";
import { CAPITAL_CIRCLE_NETWORK, type CapitalCircleNetwork } from "./chain";

/**
 * EIP-681 token-transfer URI — the same convention Circle's own CLI uses for `wallet fund
 * --method crypto`'s QR code. Wallets that support it (MetaMask mobile, Trust Wallet, etc.)
 * pre-fill both the collateral token and the recipient address; wallets that don't just see an
 * address to scan and fall back to manual token/network selection. Amount is deliberately
 * omitted — deposit sizes vary, so this only ever pre-fills who and what, never how much.
 *
 * Pure and network-parameterized specifically so both mainnet and testnet output are directly
 * testable — the env-bound singleton this used to read straight from can only ever reflect
 * whichever network this process actually booted with.
 */
export function buildUsdcDepositUri(walletAddress: string, network: CapitalCircleNetwork): string {
  return `ethereum:${network.collateralTokenAddress}@${network.chainId}/transfer?address=${walletAddress}`;
}

export function usdcDepositUri(walletAddress: string): string {
  return buildUsdcDepositUri(walletAddress, CAPITAL_CIRCLE_NETWORK);
}

/** Server-rendered inline SVG — no client JS, no external request, safe to drop straight into a server component. */
export async function walletDepositQrSvg(walletAddress: string): Promise<string> {
  return QRCode.toString(usdcDepositUri(walletAddress), { type: "svg", margin: 1, width: 160 });
}
