import { describe, expect, it } from "vitest";
import { Chain, getContractConfig } from "@polymarket/clob-client-v2";

/**
 * Not a normal "test our own code" suite — this pins the third-party SDK's own exported
 * collateral addresses against values independently verified against PolygonScan and
 * Polymarket's docs (see circle-wallet-client.ts's COLLATERAL_TOKEN_ADDRESS comment for the
 * full story: Polymarket migrated collateral from USDC.e to their own pUSD token on
 * 2026-04-28, and this codebase used to hardcode the wrong, pre-migration token address).
 *
 * A silent value change here on a future `@polymarket/clob-client-v2` bump — another
 * collateral migration, or a packaging mistake — is exactly the class of bug that cost real
 * time to find once already. This is the tripwire.
 */
describe("Polymarket collateral token (via the SDK's own getContractConfig)", () => {
  it("is pUSD on Polygon mainnet, not native USDC or USDC.e", () => {
    const { collateral } = getContractConfig(Chain.POLYGON);
    expect(collateral).toBe("0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB");
    expect(collateral).not.toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"); // native USDC — the old, wrong constant
    expect(collateral).not.toBe("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"); // USDC.e — pre-migration collateral
  });

  it("has a collateral address configured for testnet (Amoy) too", () => {
    const { collateral } = getContractConfig(Chain.AMOY);
    expect(collateral).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
