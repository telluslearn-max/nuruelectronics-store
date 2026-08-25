import "server-only";

/**
 * Phase A / Phase B gate — see the project's "Two Circles" plan doc. Circle
 * wallet spending policies require a mainnet agent wallet (no testnet), and
 * the owner hasn't completed Circle's KYB yet, so this can only be "false"
 * today. When true, executor-tool.ts will still refuse to place a real order
 * unless isCircleWalletConfigured is also true — this flag alone never
 * bypasses that check.
 */
export const CAPITAL_CIRCLE_LIVE = process.env.CAPITAL_CIRCLE_LIVE === "true";

/**
 * Conservative default per-position cap used while no CapitalCircleWallet
 * row has real Circle-configured caps yet. Mirrors what Risk/Sizing would
 * set as the wallet's real per-tx limit via `circle wallet limit set` in
 * Phase B — kept here so sizing logic is real and testable before funding.
 */
export const DEFAULT_PER_POSITION_CAP_USD = Number(process.env.CAPITAL_CIRCLE_DEFAULT_CAP_USD ?? 25);

/**
 * Share of each week's real profit staged for conversion into the Capital
 * Circle wallet. Recorded on every CapitalCircleSweep row too (not just read
 * from here), so a historical sweep's actual split stays correct even if
 * this default changes later.
 */
export const CAPITAL_CIRCLE_SWEEP_PERCENT = Number(process.env.CAPITAL_CIRCLE_SWEEP_PERCENT ?? 40);

/**
 * Pinned explicitly rather than an alias, so a model swap is a deliberate change.
 *
 * gemini-2.5-flash -> gemini-3.1-pro -> gemini-3.5-flash. The Pro swap (in the hope that
 * stronger reasoning fixes calibration) was reverted for cost a day later: at $2.00/$12.00 per
 * million input/output tokens against an ensemble of ENSEMBLE_SAMPLES calls across every
 * screened outcome each cycle, the cost multiplied directly and added up fast. gemini-3.5-flash
 * is a full generation newer than the original 2.5-flash (not just a same-tier refresh) at
 * $1.50/$9.00 — ~25% cheaper than 3.1-pro, and it outscores 3.1-pro on coding/agentic
 * benchmarks despite the lower price, so this isn't a pure cost-for-quality tradeoff.
 * gemini-3.1-flash-lite ($0.25/$1.50) is the next step down if this still isn't cheap enough,
 * but Lite-tier trades away real reasoning depth, which is risky right after fixing a
 * calibration problem. Revisit against the calibration numbers (post-701b71d fix, post-dedup)
 * once enough cycles have run on this model to judge it.
 */
export const CAPITAL_CIRCLE_MODEL = "gemini-3.5-flash";

/**
 * Raised from 5: the cycle's deep-dive stage now screens finalists with
 * get_price_history / get_order_book before confirming, and 5 iterations
 * left it hitting the cap mid-verification and returning "inconclusive".
 */
export const MAX_TOOL_ITERATIONS = Number(process.env.CAPITAL_CIRCLE_MAX_ITERATIONS ?? 12);

/**
 * Gemini 2.5 Flash thinking budget (tokens) for the scoring and deep-dive
 * calls. Probability estimation is the one step where reasoning depth maps
 * directly to money, and flash's thinking tokens are cheap enough that a
 * budget here is close to free relative to the size of the positions.
 */
export const THINKING_BUDGET = Number(process.env.CAPITAL_CIRCLE_THINKING_BUDGET ?? 2048);

// ---------------------------------------------------------------------------
// Candidate screening — applied in code (candidate-filter.ts) before the model
// ever sees a market, so an untradeable market can't be picked no matter how
// good the thesis sounds.
// ---------------------------------------------------------------------------

/** Below this, the book is too thin for even a $25 fill to avoid moving the price. */
export const MIN_LIQUIDITY_USD = Number(process.env.CAPITAL_CIRCLE_MIN_LIQUIDITY_USD ?? 400);

/** A market nobody traded today has a stale, uninformative price — and no exit. */
export const MIN_VOLUME_24H_USD = Number(process.env.CAPITAL_CIRCLE_MIN_VOLUME_24H_USD ?? 200);

/** Spread is a round-trip cost. Wider than this eats any edge we could plausibly have. */
export const MAX_SPREAD = Number(process.env.CAPITAL_CIRCLE_MAX_SPREAD ?? 0.08);

/**
 * Entry-price band. Above MAX: the payoff is a few cents against a full-size
 * downside, so a single surprise wipes out dozens of wins. Below MIN: a
 * lottery ticket whose probability we cannot estimate to that precision.
 *
 * MAX lowered from 0.97, for two reasons that point the same way.
 *
 * The first is arithmetic, and it makes most of the old band unreachable rather than merely
 * unwise. Clearing the edge gate needs the model (minEdge + COST_BUFFER)/λ above the entry price
 * — see requiredDeviation in trade-policy.ts — and a probability cannot exceed 1, so the highest
 * entry the gate can ever accept is 1 − that same quantity. At the λ measured in production
 * today (0.287) the strict bar cannot reach any entry above 0.861, and the relaxed bar cannot
 * reach above 0.923. Everything between there and 0.97 was advertised as tradeable, priced by the
 * model every cycle, and structurally incapable of producing a trade.
 *
 * The second is risk. Buying at 0.90 stakes ninety cents to win ten: one loss erases nine wins,
 * and a forecast error of a couple of points flips the sign of the edge outright. That is exactly
 * the regime where an imperfectly calibrated estimate does the most damage.
 *
 * Costs nothing in coverage, which is why it is worth doing: verified against a live 72h window,
 * the screened universe was unchanged at 178 markets and the slate still filled to 48. Binary
 * markets always carry a cheap side, so tightening the ceiling steers the desk to the side of the
 * book with a real payoff rather than removing the market.
 */
export const MAX_ENTRY_PRICE = Number(process.env.CAPITAL_CIRCLE_MAX_ENTRY_PRICE ?? 0.9);
export const MIN_ENTRY_PRICE = Number(process.env.CAPITAL_CIRCLE_MIN_ENTRY_PRICE ?? 0.03);

/**
 * How many screened markets get priced by the model each cycle — the real width of the funnel,
 * and the one number that decides how many chances the desk gets per hour.
 *
 * Raising MARKET_FETCH_LIMIT alone does almost nothing: fetching 300 markets to price 24 only
 * changes *which* 24 get picked, not how many shots on goal there are. Clearing the edge bar
 * requires the model to disagree with a liquid market by several percentage points (see
 * requiredDeviation in trade-policy.ts), which is rare per market — so the number of tradeable
 * candidates found per cycle scales with how many get priced, and 24 markets (~48 outcomes) was
 * the binding constraint on a desk asked to find three positions a day.
 *
 * 48 rather than higher because the ceiling here is the scoring call's *output* budget, not its
 * input: one JSON estimate per outcome token, so this many markets is roughly 96 estimates per
 * sample and three samples per cycle. Input cost is negligible on Flash (well under a dollar a
 * day at hourly cycles); output truncation is the failure mode that would silently drop
 * candidates, which is why agent-loop.ts sets an explicit maxOutputTokens rather than trusting
 * the default.
 */
export const CANDIDATE_LIMIT = Number(process.env.CAPITAL_CIRCLE_CANDIDATE_LIMIT ?? 48);

/**
 * How far out to hunt. A 24-hour horizon was the original short-feedback-loop
 * choice, but it also caps how many opportunities exist at all — and on a quiet
 * hour it's the difference between a thin slate and no slate. Three days keeps
 * feedback fast enough to learn from while widening the field substantially.
 */
export const SEARCH_HORIZON_HOURS = Number(process.env.CAPITAL_CIRCLE_SEARCH_HORIZON_HOURS ?? 72);

/**
 * Raw markets pulled from Gamma before code-side screening. Screening is cheap; missing a market
 * isn't. Gamma caps a single request at 100 rows regardless of the limit requested — verified
 * live — so listActivePolymarketMarkets paginates via offset to actually reach this number; it
 * previously silently topped out at 100 no matter what this was set to. Raised from 150 now that
 * more is actually reachable: the horizon-bucketed ranking in candidate-filter.ts most needs
 * depth in whichever bucket isn't dominated by a handful of huge crypto/political markets, and a
 * shallow raw pull starves exactly that bucket first.
 */
export const MARKET_FETCH_LIMIT = Number(process.env.CAPITAL_CIRCLE_MARKET_FETCH_LIMIT ?? 300);

// ---------------------------------------------------------------------------
// Edge and sizing — the code-side decision layer. The model estimates
// probabilities; these constants decide whether an estimate is worth money.
// ---------------------------------------------------------------------------

/**
 * Minimum edge (probability minus effective entry price minus costs) before a
 * trade is allowed on a normal cycle. Above zero because an LLM's probability
 * estimate carries far more error than a market maker's price, so small
 * apparent divergences are usually estimation noise rather than opportunity.
 */
export const MIN_EDGE = Number(process.env.CAPITAL_CIRCLE_MIN_EDGE ?? 0.03);

/**
 * The relaxed bar used once a day has gone by without a position — see
 * computeUrgency in trade-policy.ts. The pool is meant to be *in* the market,
 * and a desk that waits for perfect setups compounds nothing while it waits;
 * a thinner edge taken at a smaller size beats no edge at all.
 *
 * Deliberately still above zero. This lowers the bar, it does not remove it:
 * a trade below zero expected value isn't a position, it's a donation, and
 * forcing one to satisfy a quota would be the single fastest way to lose the
 * pool. When nothing clears even this, the cycle passes and says so.
 */
export const MIN_EDGE_WHEN_HUNGRY = Number(process.env.CAPITAL_CIRCLE_MIN_EDGE_WHEN_HUNGRY ?? 0.012);

/**
 * Positions per day the desk aims to place, provided something clears the (relaxed) bar — a
 * floor to hit, not a ceiling: MAX_POSITIONS_PER_CYCLE (4) already allows more in a single hour
 * if the market offers them, and hitting this target just means computeUrgency stops relaxing the
 * edge bar for the rest of the day. 3 rather than 1 because the hunger ramp resets on every
 * position regardless of count — see computeUrgency in trade-policy.ts — so raising this doesn't
 * need any other threshold retuned to fit multiple positions across a day.
 */
export const DAILY_POSITION_TARGET = Number(process.env.CAPITAL_CIRCLE_DAILY_POSITION_TARGET ?? 3);

/**
 * Hours without a position before the bar starts sliding from MIN_EDGE toward
 * MIN_EDGE_WHEN_HUNGRY. Ramped rather than switched, so the desk gets steadily
 * less picky across the day instead of holding out and then lurching.
 */
export const HUNGRY_AFTER_HOURS = Number(process.env.CAPITAL_CIRCLE_HUNGRY_AFTER_HOURS ?? 6);

/** Hours by which the bar has fully relaxed — the point where the daily target is clearly at risk. */
export const STARVING_AFTER_HOURS = Number(process.env.CAPITAL_CIRCLE_STARVING_AFTER_HOURS ?? 20);

/**
 * Assumed slippage/adverse-selection drag on top of the quoted ask — the ask
 * is what the top of the book shows, not necessarily what a taker order gets.
 */
export const COST_BUFFER = Number(process.env.CAPITAL_CIRCLE_COST_BUFFER ?? 0.01);

/** Polymarket taker fees are 0 on most markets today; kept explicit so cost modelling is visible and tunable. */
export const FEE_BPS = Number(process.env.CAPITAL_CIRCLE_FEE_BPS ?? 0);

/** Used when neither an order book nor a spread is available for a token. */
export const DEFAULT_SPREAD_ASSUMPTION = Number(process.env.CAPITAL_CIRCLE_DEFAULT_SPREAD ?? 0.01);

/**
 * How much of the model's probability estimate to trust versus the market's
 * own price. p' = λ·model + (1−λ)·market. The market price is the base rate
 * set by people with money at risk; λ is how much evidence we think one
 * flash call adds on top of it. Starts pessimistic and becomes adaptive once
 * enough resolved predictions exist to measure calibration (trade-policy.ts).
 */
export const KELLY_SHRINKAGE = Number(process.env.CAPITAL_CIRCLE_KELLY_SHRINKAGE ?? 0.5);

/**
 * Log-odds extremization factor applied to each ensembled probability before shrinkage (see
 * extremizeProbability in ensemble.ts). d=1 is the identity — ships inert by default. Forecasting
 * literature (Good Judgment Project) suggests d≈1.25-1.35 corrects real under-confidence in
 * aggregated estimates, but that range hasn't been backtested against this desk's own calibration
 * history, and turning it on measurably increases apparent edge (and therefore trade size and
 * frequency) with no data yet to justify a specific value. Deliberately left at 1 until someone
 * backtests it against CapitalCircleCandidateSnapshot and picks a value on purpose.
 */
export const EXTREMIZE_FACTOR = Number(process.env.CAPITAL_CIRCLE_EXTREMIZE_FACTOR ?? 1);

/**
 * Fraction of full Kelly. Half-Kelly rather than quarter: full Kelly is only
 * optimal when the probability is known exactly and it drawdowns brutally when
 * it isn't, but quarter-Kelly on a $25 cap produces stakes so small that the
 * pool barely compounds. Half is the aggressive-but-not-reckless middle, and
 * the shrinkage above is doing the real work of correcting for estimate error.
 */
export const KELLY_FRACTION = Number(process.env.CAPITAL_CIRCLE_KELLY_FRACTION ?? 0.5);

/**
 * Starting size of the pool Kelly sizes against.
 *
 * While simulating (CAPITAL_CIRCLE_LIVE=false), this is the literal starting balance of a
 * tracked paper account — see getSimulatedAccountState() in track-record.ts — not just a
 * theoretical sizing input: Kelly sizes against that account's *current* balance (this number
 * plus realized P&L), and sizePosition() in sizing-tool.ts refuses new positions once it hits
 * zero, the same way real capital would run out. That's deliberate: the simulation is meant to
 * be judged as if it actually held this much money, consistent profit against a bounded budget
 * being the bar for trusting it with real funds, not just a positive skill score in isolation.
 * Once live, real wallet balance replaces this for sizing (see Phase B), and this constant only
 * remains as the pre-funding fallback.
 */
export const BANKROLL_USD = Number(process.env.CAPITAL_CIRCLE_BANKROLL_USD ?? 800);

/** Never take more than this share of the resting ask-side depth — being the whole book is how you pay the whole spread. */
export const MAX_BOOK_DEPTH_SHARE = Number(process.env.CAPITAL_CIRCLE_MAX_BOOK_DEPTH_SHARE ?? 0.1);

// ---------------------------------------------------------------------------
// Portfolio limits — the old code had none: only a per-position cap, which a
// simulated position bypassed entirely.
// ---------------------------------------------------------------------------

export const MAX_POSITIONS_PER_CYCLE = Number(process.env.CAPITAL_CIRCLE_MAX_POSITIONS_PER_CYCLE ?? 4);
export const MAX_OPEN_POSITIONS = Number(process.env.CAPITAL_CIRCLE_MAX_OPEN_POSITIONS ?? 12);
export const MAX_TOTAL_EXPOSURE_USD = Number(process.env.CAPITAL_CIRCLE_MAX_TOTAL_EXPOSURE_USD ?? 300);

/**
 * Circuit breaker. A losing streak is either bad luck or a broken thesis
 * generator, and the code cannot tell which — so it stops and asks a human
 * rather than compounding the second case.
 */
export const MAX_WEEKLY_DRAWDOWN_USD = Number(process.env.CAPITAL_CIRCLE_MAX_WEEKLY_DRAWDOWN_USD ?? 75);
export const MAX_CONSECUTIVE_LOSSES = Number(process.env.CAPITAL_CIRCLE_MAX_CONSECUTIVE_LOSSES ?? 6);

// ---------------------------------------------------------------------------
// Exits — previously nonexistent: every position was held to resolution.
// ---------------------------------------------------------------------------

/** Take profit here rather than carrying resolution risk for the last few cents. */
export const TAKE_PROFIT_PRICE = Number(process.env.CAPITAL_CIRCLE_TAKE_PROFIT_PRICE ?? 0.95);

/** Cut when the price has fallen this far below entry — the thesis is measurably wrong, recover what's left. */
export const STOP_LOSS_FRACTION = Number(process.env.CAPITAL_CIRCLE_STOP_LOSS_FRACTION ?? 0.5);

/** A market that never closes would otherwise leave a position open forever, silently understating exposure. */
export const SETTLEMENT_STALE_HOURS = Number(process.env.CAPITAL_CIRCLE_SETTLEMENT_STALE_HOURS ?? 72);

// ---------------------------------------------------------------------------
// Ensembling — one sampled probability from a flash model is noisy; the median
// of a few independent samples is the cheapest available variance reduction.
// ---------------------------------------------------------------------------

/**
 * Whether the scoring model is shown each outcome's current market price.
 *
 * Defaults to true, which is how the desk has always run, but the default is worth
 * understanding rather than inheriting. The price is a genuine base rate — and the code
 * already blends the model's estimate with it in shrinkProbability (p' = λ·model + (1−λ)·market),
 * so a model that anchors on the price has it counted twice, and one that simply hands it back
 * produces an estimate with no information in it at all. Production does the latter: the
 * passthrough detector reports the quoted price returned verbatim on 90-96 of 96 outcomes, cycle
 * after cycle, which makes edge equal to −costs by construction and no gate setting can rescue it.
 *
 * Setting this to false makes the scoring stage blind, so its estimates are the model's own and
 * the blend happens once, in code, where it is measurable. It is off by default because it is a
 * behavioural change to what the desk trades and deserves to be turned on deliberately and watched
 * on its own — not bundled into a correctness fix and credited with its results.
 */
export const SHOW_MARKET_PRICE_TO_MODEL = process.env.CAPITAL_CIRCLE_SHOW_MARKET_PRICE !== "false";

export const ENSEMBLE_SAMPLES = Number(process.env.CAPITAL_CIRCLE_ENSEMBLE_SAMPLES ?? 3);
export const ENSEMBLE_TEMPERATURE = Number(process.env.CAPITAL_CIRCLE_ENSEMBLE_TEMPERATURE ?? 0.7);

/** Spread between the highest and lowest sample above which the estimate is treated as "the model doesn't know". */
export const ENSEMBLE_MAX_DISAGREEMENT = Number(process.env.CAPITAL_CIRCLE_ENSEMBLE_MAX_DISAGREEMENT ?? 0.25);

/** Resolved predictions needed before measured calibration replaces the KELLY_SHRINKAGE prior. */
export const MIN_SAMPLES_FOR_ADAPTIVE_SHRINKAGE = Number(process.env.CAPITAL_CIRCLE_MIN_CALIBRATION_SAMPLES ?? 30);

/**
 * How many resolved candidate snapshots calibration is measured over.
 *
 * Shared by the agent's own track record and the admin report on purpose. They previously
 * used different windows — the report read 500 rows, the cycle read 200 — and each then called
 * computeAdaptiveShrinkage independently, so the λ displayed on the dashboard was not the λ the
 * desk was actually gating trades with. Two numbers with the same name and different values is
 * the kind of thing that survives a long time precisely because both look right on their own.
 */
export const CALIBRATION_SAMPLE_LIMIT = Number(process.env.CAPITAL_CIRCLE_CALIBRATION_SAMPLE_LIMIT ?? 500);
