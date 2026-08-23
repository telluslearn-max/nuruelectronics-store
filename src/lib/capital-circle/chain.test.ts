import { describe, expect, it } from "vitest";
import { networkConfig } from "./chain";

describe("networkConfig — the regression lock on the wrong-chain / wrong-collateral bug", () => {
  it("mainnet: chain 137, pUSD collateral, polygonscan", () => {
    const network = networkConfig(false);
    expect(network).toMatchObject({
      key: "polygon",
      chainId: 137,
      collateralTokenAddress: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
      explorerBaseUrl: "https://polygonscan.com",
      isTestnet: false,
    });
  });

  it("testnet: chain 80002, Amoy collateral, amoy.polygonscan", () => {
    const network = networkConfig(true);
    expect(network.key).toBe("polygon-amoy");
    expect(network.chainId).toBe(80002);
    expect(network.explorerBaseUrl).toBe("https://amoy.polygonscan.com");
    expect(network.isTestnet).toBe(true);
    expect(network.collateralTokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("mainnet and testnet collateral addresses are both present and well-formed", () => {
    expect(networkConfig(false).collateralTokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networkConfig(true).collateralTokenAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("mainnet: bridge/wrap addresses match what was independently verified (Blockscout tx history + docs.polymarket.com)", () => {
    const network = networkConfig(false);
    expect(network.nativeUsdcAddress).toBe("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
    expect(network.usdcEAddress).toBe("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
    expect(network.collateralOnrampAddress).toBe("0x93070a847efEf7F70739046A929D47a521F5B8ee");
    // The three must be distinct from each other and from the collateral (pUSD) token — a typo
    // that collapsed any two of these would silently send funds nowhere useful.
    const addresses = [network.nativeUsdcAddress, network.usdcEAddress, network.collateralOnrampAddress, network.collateralTokenAddress];
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("testnet: bridge/wrap addresses are null, not guessed", () => {
    const network = networkConfig(true);
    expect(network.nativeUsdcAddress).toBeNull();
    expect(network.usdcEAddress).toBeNull();
    expect(network.collateralOnrampAddress).toBeNull();
  });
});
