import { describe, expect, it } from "vitest";
import { salvageScoringEstimates } from "./agent-loop";

/**
 * Regression cover for a real production failure: widening the slate pushed the scoring response
 * past its output ceiling, and because JSON.parse is all-or-nothing, a single unterminated string
 * at the tail discarded every estimate that had already arrived. All three ensemble samples came
 * back empty and the cycle logged "no usable probabilities — no trade" — strictly worse than the
 * narrower slate it replaced, and invisible except as an unusually quiet hour.
 *
 * The identifiers are shaped like the real ones (66-char hex conditionId, 77-digit tokenId) since
 * their length is what makes truncation likely in the first place.
 */
const marketId = `0x${"a".repeat(64)}`;
const tokenId = "9".repeat(77);

function estimate(index: number, probability: number, rationale?: string): string {
  const rationalePart = rationale === undefined ? "" : `, "rationale": ${JSON.stringify(rationale)}`;
  return `{"marketId": "${marketId}${index}", "tokenId": "${tokenId}${index}", "probability": ${probability}${rationalePart}}`;
}

describe("salvageScoringEstimates", () => {
  it("recovers every complete estimate from a response cut off mid-string", () => {
    // Exactly the shape the logs showed: valid entries, then a truncated one with an open quote.
    const truncated = `{"estimates": [${estimate(1, 0.62)}, ${estimate(2, 0.31)}, {"marketId": "${marketId}3", "tokenId": "${tokenId}3", "probability": 0.4, "rationale": "the book is thin and`;

    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toMatchObject({ marketId: `${marketId}1`, tokenId: `${tokenId}1`, probability: 0.62 });
    expect(recovered[1].probability).toBe(0.31);
  });

  it("is not confused by braces inside a rationale string", () => {
    const truncated = `{"estimates": [${estimate(1, 0.55, "resolves if {A} or {B} happens")}, {"marketId": "x`;
    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].probability).toBe(0.55);
  });

  it("handles an escaped quote inside a rationale without losing brace tracking", () => {
    const truncated = `{"estimates": [${estimate(1, 0.7, 'the market says "no" already')}, {"marketId": "x`;
    expect(salvageScoringEstimates(truncated)).toHaveLength(1);
  });

  it("drops entries missing the fields a trade would need, keeping the rest", () => {
    const truncated = `{"estimates": [{"marketId": "m1", "probability": 0.5}, ${estimate(2, 0.44)}, {"tok`;
    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].probability).toBe(0.44);
  });

  it("returns nothing when the cut lands before any estimate completed", () => {
    expect(salvageScoringEstimates(`{"estimates": [{"marketId": "${marketId}1", "tokenId": "${tokenId}`)).toEqual([]);
    expect(salvageScoringEstimates("")).toEqual([]);
  });

  it("still reads a well-formed response, so the salvage path is never a downgrade", () => {
    const whole = `{"estimates": [${estimate(1, 0.62)}, ${estimate(2, 0.31)}]}`;
    expect(salvageScoringEstimates(whole)).toHaveLength(2);
  });
});
