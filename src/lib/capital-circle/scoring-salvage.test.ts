import { describe, expect, it } from "vitest";
import { salvageScoringEstimates } from "./agent-loop";

/**
 * Regression cover for a real production failure: widening the slate pushed the scoring response
 * past its output ceiling, and because JSON.parse is all-or-nothing, a single unterminated string
 * at the tail discarded every estimate that had already arrived. All three ensemble samples came
 * back empty and the cycle logged "no usable probabilities — no trade" — strictly worse than the
 * narrower slate it replaced, and invisible except as an unusually quiet hour.
 *
 * Salvage recovers raw objects and judges none of them. Whether an entry is usable depends on the
 * slate it was priced against — that its ref exists, and that the outcome name it carries belongs
 * to that ref rather than to the market's other side — so validation lives in
 * resolveScoringEstimates and is covered in scoring-slate.test.ts. Keeping it in one place is what
 * stops the salvage path and the happy path drifting into disagreeing about what a valid estimate
 * is, which is exactly the sort of gap a mis-paired probability slips through.
 */
function estimate(ref: string, outcome: string, probability: number, rationale?: string): string {
  const rationalePart = rationale === undefined ? "" : `, "rationale": ${JSON.stringify(rationale)}`;
  return `{"ref": "${ref}", "outcome": ${JSON.stringify(outcome)}, "probability": ${probability}${rationalePart}}`;
}

describe("salvageScoringEstimates", () => {
  it("recovers every complete estimate from a response cut off mid-string", () => {
    // Exactly the shape the logs showed: valid entries, then a truncated one with an open quote.
    const truncated = `{"estimates": [${estimate("m1a", "Yes", 0.62)}, ${estimate("m1b", "No", 0.38)}, {"ref": "m2a", "outcome": "T1", "probability": 0.4, "rationale": "the book is thin and`;

    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toMatchObject({ ref: "m1a", outcome: "Yes", probability: 0.62 });
    expect(recovered[1].probability).toBe(0.38);
  });

  it("is not confused by braces inside a rationale string", () => {
    const truncated = `{"estimates": [${estimate("m1a", "Yes", 0.55, "resolves if {A} or {B} happens")}, {"ref": "m2`;
    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(1);
    expect(recovered[0].probability).toBe(0.55);
  });

  it("handles an escaped quote inside a rationale without losing brace tracking", () => {
    const truncated = `{"estimates": [${estimate("m1a", "Yes", 0.7, 'the market says "no" already')}, {"ref": "m2`;
    expect(salvageScoringEstimates(truncated)).toHaveLength(1);
  });

  it("returns entries verbatim without judging them — that is resolveScoringEstimates' job", () => {
    // A half-formed entry is recovered here and rejected downstream, where the slate is available
    // to say *why* it was rejected. Dropping it silently at this layer is what used to make a
    // formatting problem and a mis-paired outcome look identical from the cycle log.
    const truncated = `{"estimates": [{"ref": "m1a", "probability": 0.5}, ${estimate("m2a", "Over", 0.44)}, {"re`;
    const recovered = salvageScoringEstimates(truncated);
    expect(recovered).toHaveLength(2);
    expect(recovered[0]).toEqual({ ref: "m1a", probability: 0.5 });
    expect(recovered[1].probability).toBe(0.44);
  });

  it("returns nothing when the cut lands before any estimate completed", () => {
    expect(salvageScoringEstimates(`{"estimates": [{"ref": "m1a", "outcome": "Ye`)).toEqual([]);
    expect(salvageScoringEstimates("")).toEqual([]);
  });

  it("still reads a well-formed response, so the salvage path is never a downgrade", () => {
    const whole = `{"estimates": [${estimate("m1a", "Yes", 0.62)}, ${estimate("m1b", "No", 0.38)}]}`;
    expect(salvageScoringEstimates(whole)).toHaveLength(2);
  });
});
