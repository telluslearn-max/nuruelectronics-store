import "server-only";
import { Chain, getContractConfig } from "@polymarket/clob-client-v2";

export type CapitalCircleNetwork = {
  key: "polygon" | "polygon-amoy";
  chainId: 137 | 80002;
  /** See circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment — not always USDC. */
  collateralTokenAddress: string;
  explorerBaseUrl: string;
  label: string;
  isTestnet: boolean;
};

/** Matches @polymarket/clob-client-v2's own COLLATERAL_TOKEN_DECIMALS — re-declared rather than
    imported so callers that only need the number don't have to pull in the whole SDK's types. */
export const COLLATERAL_DECIMALS = 6;

/** Pure — the actual regression lock lives in chain.test.ts, pinning these values against a
    silent change on a future @polymarket/clob-client-v2 bump. */
export function networkConfig(isTestnet: boolean): CapitalCircleNetwork {
  if (isTestnet) {
    return {
      key: "polygon-amoy",
      chainId: 80002,
      collateralTokenAddress: getContractConfig(Chain.AMOY).collateral,
      explorerBaseUrl: "https://amoy.polygonscan.com",
      label: "Polygon Amoy (testnet)",
      isTestnet: true,
    };
  }
  return {
    key: "polygon",
    chainId: 137,
    collateralTokenAddress: getContractConfig(Chain.POLYGON).collateral,
    explorerBaseUrl: "https://polygonscan.com",
    label: "Polygon",
    isTestnet: false,
  };
}

/**
 * Single source of network identity for the whole Capital Circle wallet feature. Reads the env
 * var itself rather than importing isCircleWalletTestnet from circle-wallet-client.ts — that file
 * needs this module's collateralTokenAddress, so importing the other direction would cycle.
 */
export const CAPITAL_CIRCLE_NETWORK: CapitalCircleNetwork = networkConfig(process.env.CAPITAL_CIRCLE_WALLET_NETWORK === "testnet");

export function explorerAddressUrl(address: string, network: CapitalCircleNetwork = CAPITAL_CIRCLE_NETWORK): string {
  return `${network.explorerBaseUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string, network: CapitalCircleNetwork = CAPITAL_CIRCLE_NETWORK): string {
  return `${network.explorerBaseUrl}/tx/${hash}`;
}

export function explorerTokenUrl(tokenAddress: string, network: CapitalCircleNetwork = CAPITAL_CIRCLE_NETWORK): string {
  return `${network.explorerBaseUrl}/token/${tokenAddress}`;
}
