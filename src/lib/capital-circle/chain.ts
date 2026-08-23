import "server-only";
import { Chain, getContractConfig } from "@polymarket/clob-client-v2";

export type CapitalCircleNetwork = {
  key: "polygon" | "polygon-amoy";
  chainId: 137 | 80002;
  /** See circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment — not always USDC. */
  collateralTokenAddress: string;
  /**
   * Native (Circle-issued) USDC on this chain — what Binance actually delivers on a Polygon
   * withdrawal (binance-client.ts queries Binance's `coin: "USDC"`, which is this token, not
   * USDC.e). Null on testnet: unconfirmed whether the bridge/onramp path below exists on Amoy at
   * all, so collateral-bridge.ts refuses rather than guessing.
   */
  nativeUsdcAddress: string | null;
  /**
   * Bridged USDC ("USDC.e") — the ONLY asset CollateralOnramp.wrap() actually accepts, verified
   * two ways: docs.polymarket.com/concepts/pusd states it explicitly, and every real wrap() call
   * ever made on the onramp contract (checked via Polygon Blockscout's tx history for
   * collateralOnrampAddress below) used this exact address, never native USDC. Binance-sourced
   * native USDC must be routed through Polymarket's own bridge API (bridge.polymarket.com) to
   * become this token before wrap() will accept it — see collateral-bridge.ts.
   */
  usdcEAddress: string | null;
  /**
   * Polymarket's "Permissionless Collateral Onramp" — mints pUSD 1:1 from USDC.e via
   * wrap(address _asset, address _to, uint256 _amount). Address and ABI cross-verified against
   * Polygon Blockscout's independently-verified contract source (Sourcify), not just docs.
   */
  collateralOnrampAddress: string | null;
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
      nativeUsdcAddress: null,
      usdcEAddress: null,
      collateralOnrampAddress: null,
      explorerBaseUrl: "https://amoy.polygonscan.com",
      label: "Polygon Amoy (testnet)",
      isTestnet: true,
    };
  }
  return {
    key: "polygon",
    chainId: 137,
    collateralTokenAddress: getContractConfig(Chain.POLYGON).collateral,
    nativeUsdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcEAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    collateralOnrampAddress: "0x93070a847efEf7F70739046A929D47a521F5B8ee",
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
