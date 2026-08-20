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
});
