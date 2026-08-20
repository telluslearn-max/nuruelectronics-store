import { describe, expect, it } from "vitest";
import { usdcDepositUri } from "./wallet-qr";

const WALLET_ADDRESS = "0xf7ce4d4Ef4C860f0f1b1D1B1E1a1b1c1d1e1f111";
const PUSD_MAINNET = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";

describe("usdcDepositUri", () => {
  it("encodes the current collateral token and Polygon mainnet chain id (no CAPITAL_CIRCLE_WALLET_NETWORK set)", () => {
    const uri = usdcDepositUri(WALLET_ADDRESS);
    expect(uri).toBe(`ethereum:${PUSD_MAINNET}@137/transfer?address=${WALLET_ADDRESS}`);
  });

  it("never falls back to the pre-migration native-USDC address", () => {
    const uri = usdcDepositUri(WALLET_ADDRESS);
    expect(uri).not.toContain("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
  });
});
