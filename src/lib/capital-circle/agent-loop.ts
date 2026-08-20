import "server-only";
import { FunctionCallingConfigMode, Type, type Content, type FunctionCall, type Part } from "@google/genai";
import { prisma } from "../prisma";
import {
  CANDIDATE_LIMIT,
  CAPITAL_CIRCLE_MODEL,
  ENSEMBLE_MAX_DISAGREEMENT,
  ENSEMBLE_SAMPLES,
  ENSEMBLE_TEMPERATURE,
  MAX_POSITIONS_PER_CYCLE,
  MAX_TOOL_ITERATIONS,
  THINKING_BUDGET,
} from "./config";
import { getGenAIClient, isCapitalCircleConfigured } from "./vertex-client";
import { buildDeepDiveSystemInstruction, buildNewsSearchPrompt, buildScoringSystemInstruction } from "./system-prompt";
import { dispatchTool, functionDeclarations, logCandidateSlate, type ApprovedTrade, type ToolContext } from "./tools";
import { listActivePolymarketMarkets } from "./polymarket-client";
import { filterAndRankCandidates, toScoringView, type ScreenedMarket } from "./candidate-filter";
import { ensembleProbabilities, type ProbabilitySample } from "./ensemble";
import { selectTrades, type SelectionCandidate } from "./trade-policy";
import { getTrackRecord, getTradingUrgency, renderTrackRecordForPrompt } from "./track-record";

export type CapitalCircleCycleResult = {
  ran: boolean;
  summary: string;
  toolCallCount: number;
  candidateCount?: number;
  selectedCount?: number;
  cycleId?: string;
};

/**
 * One hourly cycle.
 *
 * The shape is deliberate and is the main change from the original design,
 * which handed one model one prompt and let it research, size, and execute in
 * a single pass — so its probability estimate and its decision to trade were
 * formed together, and nothing in code ever checked either.
 *
 *   A. Screen  — fetch live markets and filter them on liquidity, volume,
 *                spread and price band, in code, before the model sees them.
 *   B. Ground  — one grounded search pass for recent news on those questions.
 *   C. Score   — the model prices the WHOLE slate, several times, and the
 *                median is taken. Pricing everything (not just what it wants
 *                to trade) is what makes calibration measurable without the
 *                model's own selection bias; sampling several times is what
 *                stops a single hallucinated 0.95 from becoming a position.
 *   D. Select  — code computes edge against real ask prices and picks the
 *                best few. The model estimates; the code decides.
 *   E. Verify  — the model reviews just those trades with order-book and
 *                price-history tools, and may veto but not add.
 *
 * Every stage failure degrades to "no trade", never to a trade taken blind.
 */
export async function runCapitalCircleCycle(): Promise<CapitalCircleCycleResult> {
  if (!isCapitalCircleConfigured) {
    return {
      ran: false,
      summary: "Capital Circle isn't configured — Vertex AI credentials (shared with the concierge) are unset.",
      toolCallCount: 0,
    };
  }

  const cycle = await prisma.capitalCircleCycleLog.create({ data: { action: "passed" } });
  const finish = async (result: CapitalCircleCycleResult, action: string, extra: { candidateCount?: number; positionIds?: string[]; contextSnapshot?: unknown; newsContext?: string | null } = {}) => {
    await prisma.capitalCircleCycleLog
      .update({
        where: { id: cycle.id },
        data: {
          finishedAt: new Date(),
          action,
          summary: result.summary,
          toolCallCount: result.toolCallCount,
          candidateCount: extra.candidateCount ?? 0,
          positionIds: extra.positionIds ?? [],
          contextSnapshot: (extra.contextSnapshot ?? undefined) as never,
          newsContext: extra.newsContext ?? undefined,
        },
      })
      .catch((error) => console.error("[capital-circle] failed to finalize cycle log:", error));
    return { ...result, cycleId: cycle.id };
  };

  // --- A. Screen -----------------------------------------------------------
  let screened: { candidates: ScreenedMarket[]; dropped: { question: string; reason: string }[] };
  try {
    const markets = await listActivePolymarketMarkets();
    screened = filterAndRankCandidates(markets, { limit: CANDIDATE_LIMIT });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market fetch failed.";
    return finish({ ran: true, summary: `Could not fetch Polymarket markets this cycle: ${message}`, toolCallCount: 0 }, "error");
  }

  await logCandidateSlate(cycle.id, screened.candidates, screened.dropped);

  if (screened.candidates.length === 0) {
    return finish(
      {
        ran: true,
        summary: `No tradeable markets this cycle — ${screened.dropped.length} market(s) were returned but every one failed screening (liquidity, volume, spread, or price band). No trade.`,
        toolCallCount: 0,
      },
      "passed",
      { candidateCount: 0 },
    );
  }

  // --- Context: what the agent knows about its own record ------------------
  const trackRecord = await getTrackRecord().catch((error) => {
    console.error("[capital-circle] track record unavailable:", error);
    return null;
  });
  const lambda = trackRecord?.shrinkage.lambda;

  // How hard to hunt this cycle: the edge bar slides down the longer the desk has gone
  // without a position, so a quiet day ends in a thinner trade rather than no trade.
  const urgency = await getTradingUrgency().catch((error) => {
    console.error("[capital-circle] urgency unavailable, holding the strict bar:", error);
    return null;
  });
  const minEdge = urgency?.minEdge;

  // --- B. Ground -----------------------------------------------------------
  const newsContext = await fetchNewsContext(screened.candidates.map((market) => market.question));

  // --- C. Score ------------------------------------------------------------
  const scoringViews = screened.candidates.map(toScoringView);
  const contextBlock = [
    trackRecord ? renderTrackRecordForPrompt(trackRecord) : null,
    newsContext ? `Recent news search results:\n${newsContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const samples = await scoreCandidates(scoringViews, contextBlock);
  if (samples.length === 0) {
    return finish(
      { ran: true, summary: "The scoring pass returned no usable probabilities this cycle — no trade.", toolCallCount: 0 },
      "error",
      { candidateCount: screened.candidates.length, contextSnapshot: trackRecord, newsContext },
    );
  }

  const estimates = ensembleProbabilities(samples);
  await persistSnapshots(cycle.id, screened.candidates, estimates);

  // --- D. Select -----------------------------------------------------------
  const selectionCandidates = buildSelectionCandidates(screened.candidates, estimates);
  const openPositions = trackRecord?.openPositions ?? [];
  const selection = selectTrades({
    candidates: selectionCandidates,
    openMarketIds: new Set(openPositions.map((position) => position.marketId)),
    openEventIds: new Set(openPositions.map((position) => position.eventId).filter((id): id is string => Boolean(id))),
    maxPositions: MAX_POSITIONS_PER_CYCLE,
    lambda,
    minEdge,
    maxDisagreement: ENSEMBLE_MAX_DISAGREEMENT,
  });

  if (selection.selected.length === 0) {
    const closest = [...selection.rejected].sort((a, b) => b.edge - a.edge)[0];
    return finish(
      {
        ran: true,
        summary: `Priced ${estimates.length} outcomes across ${screened.candidates.length} markets; none cleared the ${(minEdge ?? 0).toFixed(4)} edge bar${urgency?.hungry ? " (already relaxed — " + urgency.reason + ")" : ""}. Closest was ${closest ? `edge ${closest.edge.toFixed(4)} — ${closest.reason}` : "not measurable"}. No trade this hour.`,
        toolCallCount: 0,
        candidateCount: screened.candidates.length,
        selectedCount: 0,
      },
      "edge_rejected",
      { candidateCount: screened.candidates.length, contextSnapshot: trackRecord, newsContext },
    );
  }

  // --- E. Verify and record ------------------------------------------------
  const approvedTrades = new Map<string, ApprovedTrade>();
  for (const trade of selection.selected) {
    const market = screened.candidates.find((candidate) => candidate.conditionId === trade.marketId);
    const estimate = estimates.find((entry) => entry.tokenId === trade.tokenId);
    approvedTrades.set(trade.tokenId, {
      conditionId: trade.marketId,
      tokenId: trade.tokenId,
      question: trade.question,
      // No ceiling from this stage — recordPosition derives the real size from the trade's
      // own edge and the pool's caps, which is strictly tighter than anything guessed here.
      sizeUsd: null,
      eventId: trade.eventId ?? null,
      category: trade.category ?? null,
      marketEndDate: market?.endDate ?? null,
      probEstimates: estimate?.samples ?? null,
    });
  }

  const verification = await runDeepDive(selection.selected, contextBlock, urgency, {
    cycleId: cycle.id,
    lambda: lambda ?? 0,
    // The executor re-gates at live prices; without the same relaxed bar it would refuse
    // exactly the thinner trades this cycle deliberately went looking for.
    minEdge,
    approvedTrades,
  });

  const recorded = await prisma.capitalCirclePosition.findMany({
    where: { cycleId: cycle.id, status: { in: ["simulated", "executed"] } },
    select: { id: true },
  });

  return finish(
    {
      ran: true,
      summary: verification.summary,
      toolCallCount: verification.toolCallCount,
      candidateCount: screened.candidates.length,
      selectedCount: selection.selected.length,
    },
    recorded.length > 0 ? "traded" : "passed",
    {
      candidateCount: screened.candidates.length,
      positionIds: recorded.map((position) => position.id),
      contextSnapshot: trackRecord,
      newsContext,
    },
  );
}

// ---------------------------------------------------------------------------
// Stage B — grounded news
// ---------------------------------------------------------------------------

/** Long enough to carry a real development per market, short enough not to crowd out the market data. */
const MAX_NEWS_CONTEXT_CHARS = 2000;

/**
 * A separate call rather than a tool, because Gemini rejects a request that
 * mixes googleSearch with function declarations. Fails open: grounding is an
 * upgrade to the estimates, and losing it should cost accuracy, not the cycle.
 */
async function fetchNewsContext(questions: string[]): Promise<string | null> {
  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: CAPITAL_CIRCLE_MODEL,
      contents: [{ role: "user", parts: [{ text: buildNewsSearchPrompt(questions) }] }],
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text?.trim();
    return text ? text.slice(0, MAX_NEWS_CONTEXT_CHARS) : null;
  } catch (error) {
    console.error("[capital-circle] news grounding unavailable, continuing without it:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stage C — batch scoring with self-consistency
// ---------------------------------------------------------------------------

const scoringResponseSchema = {
  type: Type.OBJECT,
  properties: {
    estimates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          marketId: { type: Type.STRING },
          tokenId: { type: Type.STRING },
          probability: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
        },
        required: ["marketId", "tokenId", "probability"],
      },
    },
  },
  required: ["estimates"],
} as const;

/**
 * Runs the scoring prompt ENSEMBLE_SAMPLES times at a non-zero temperature.
 * The samples are independent draws, so a market where the model is genuinely
 * uncertain produces visibly scattered numbers — which is information the
 * selection stage uses, not noise to be averaged away silently.
 */
async function scoreCandidates(views: ReturnType<typeof toScoringView>[], contextBlock: string): Promise<ProbabilitySample[][]> {
  const ai = getGenAIClient();
  const prompt = [
    contextBlock,
    "Price every outcome in the following markets. Return one estimate per outcome token.",
    JSON.stringify(views, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");

  const runs = await Promise.allSettled(
    Array.from({ length: ENSEMBLE_SAMPLES }, () =>
      ai.models.generateContent({
        model: CAPITAL_CIRCLE_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: buildScoringSystemInstruction(),
          temperature: ENSEMBLE_TEMPERATURE,
          responseMimeType: "application/json",
          responseSchema: scoringResponseSchema as never,
          thinkingConfig: { thinkingBudget: THINKING_BUDGET },
        },
      }),
    ),
  );

  const samples: ProbabilitySample[][] = [];
  for (const run of runs) {
    if (run.status !== "fulfilled") {
      console.error("[capital-circle] a scoring sample failed:", run.reason);
      continue;
    }
    const parsed = parseScoringResponse(run.value.text);
    if (parsed.length > 0) samples.push(parsed);
  }
  return samples;
}

function parseScoringResponse(text: string | undefined): ProbabilitySample[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as { estimates?: unknown };
    if (!Array.isArray(parsed.estimates)) return [];
    return parsed.estimates
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        return {
          marketId: typeof record.marketId === "string" ? record.marketId : "",
          tokenId: typeof record.tokenId === "string" ? record.tokenId : "",
          probability: Number(record.probability),
          rationale: typeof record.rationale === "string" ? record.rationale : undefined,
        };
      })
      .filter((sample) => sample.marketId && sample.tokenId && Number.isFinite(sample.probability));
  } catch (error) {
    console.error("[capital-circle] could not parse a scoring response:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Stage D helpers
// ---------------------------------------------------------------------------

function buildSelectionCandidates(markets: ScreenedMarket[], estimates: ReturnType<typeof ensembleProbabilities>): SelectionCandidate[] {
  const candidates: SelectionCandidate[] = [];
  for (const estimate of estimates) {
    const market = markets.find((entry) => entry.conditionId === estimate.marketId);
    if (!market) continue;
    const token = market.tokens.find((entry) => entry.tokenId === estimate.tokenId);
    if (!token) continue;

    candidates.push({
      marketId: market.conditionId,
      tokenId: token.tokenId,
      question: market.question,
      outcome: token.outcome,
      eventId: market.eventId,
      category: market.category,
      modelProbability: estimate.probability,
      disagreement: estimate.disagreement,
      // Gamma's per-market bestAsk covers the first outcome only, so it can't be trusted for
      // an arbitrary token here. The executor re-prices against the live book before anything
      // is recorded; this stage only needs a good enough price to rank by.
      pricing: { midpoint: token.price, spread: market.spread },
      hoursToResolution: market.hoursToResolution,
    });
  }
  return candidates;
}

async function persistSnapshots(
  cycleId: string,
  markets: ScreenedMarket[],
  estimates: ReturnType<typeof ensembleProbabilities>,
): Promise<void> {
  const rows = estimates.flatMap((estimate) => {
    const market = markets.find((entry) => entry.conditionId === estimate.marketId);
    const token = market?.tokens.find((entry) => entry.tokenId === estimate.tokenId);
    if (!market || !token) return [];
    return [
      {
        cycleId,
        marketId: market.conditionId,
        tokenId: token.tokenId,
        question: market.question,
        category: market.category,
        eventId: market.eventId,
        bestAsk: market.bestAsk,
        bestBid: market.bestBid,
        spread: market.spread,
        liquidityUsd: market.liquidity,
        volume24hUsd: market.volume24hr,
        hoursToResolution: market.hoursToResolution,
        modelProbability: estimate.probability,
        disagreement: estimate.disagreement,
      },
    ];
  });

  if (rows.length === 0) return;
  // Best-effort: the snapshot dataset powers calibration and counterfactual analysis, but
  // losing one cycle's rows must never stop that cycle from trading.
  await prisma.capitalCircleCandidateSnapshot
    .createMany({ data: rows as never })
    .catch((error) => console.error("[capital-circle] failed to persist candidate snapshots:", error));
}

// ---------------------------------------------------------------------------
// Stage E — deep-dive verification
// ---------------------------------------------------------------------------

async function runDeepDive(
  trades: ReturnType<typeof selectTrades>["selected"],
  contextBlock: string,
  urgency: { hungry: boolean; reason: string } | null,
  toolContext: ToolContext,
): Promise<{ summary: string; toolCallCount: number }> {
  const ai = getGenAIClient();
  const proposal = trades.map((trade) => ({
    conditionId: trade.marketId,
    tokenId: trade.tokenId,
    question: trade.question,
    outcome: trade.outcome,
    yourProbability: trade.modelProbability,
    shrunkProbability: Number(trade.shrunkProbability.toFixed(4)),
    marketPrice: Number(trade.effectiveEntry.toFixed(4)),
    computedEdge: Number(trade.edge.toFixed(4)),
    hoursToResolution: trade.hoursToResolution,
  }));

  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: [
            contextBlock,
            `These trades passed the edge gate on your own forecasts. Verify each one, then confirm or veto it.`,
            JSON.stringify(proposal, null, 2),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    },
  ];

  let toolCallCount = 0;
  let lastText = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = await ai.models.generateContentStream({
      model: CAPITAL_CIRCLE_MODEL,
      contents,
      config: {
        systemInstruction: buildDeepDiveSystemInstruction(urgency),
        tools: [{ functionDeclarations }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      },
    });

    let fullText = "";
    const collectedCalls: FunctionCall[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) fullText += text;
      const calls = chunk.functionCalls;
      if (calls?.length) collectedCalls.push(...calls);
    }

    if (fullText) lastText = fullText;

    if (collectedCalls.length === 0) {
      return { summary: lastText || "Cycle finished with no summary text.", toolCallCount };
    }

    const modelParts: Part[] = [];
    if (fullText) modelParts.push({ text: fullText });
    for (const call of collectedCalls) modelParts.push({ functionCall: call });
    contents.push({ role: "model", parts: modelParts });

    const responseParts: Part[] = [];
    for (const call of collectedCalls) {
      if (!call.name) continue;
      const { resultForModel } = await dispatchTool(call.name, call.args ?? {}, toolContext);
      toolCallCount++;
      responseParts.push({ functionResponse: { name: call.name, response: { output: resultForModel } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    summary: lastText || "Verification hit the iteration cap before concluding — treat as inconclusive, not a decision.",
    toolCallCount,
  };
}
