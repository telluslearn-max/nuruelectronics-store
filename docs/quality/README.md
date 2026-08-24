# Code quality: rubric, scoring, and the audit loop

This is the rubric document referenced by `.claude/skills/code-quality-audit/SKILL.md` and
`npm run quality:*`. It exists once, here — the skill and the README both point to it rather than
restating it (Ch. 16.4 of the book below: avoid duplicating documentation across places).

Everything here is grounded in *A Philosophy of Software Design* (John Ousterhout, 2nd ed.). The
short version: complexity comes from dependencies and obscurity, and the best available lever
against it is a fixed, named vocabulary for recognizing it — because "is this code too complex?"
is a judgment call, but "does this match one of these 14 named patterns?" is at least a
*consistent* one, applied the same way run over run.

## The rubric

**14 named red flags** — every finding this loop produces is classified under exactly one of
these, never a free-form category:

| Red flag | What it means |
|---|---|
| Shallow Module | Interface is about as complex as the implementation it hides. |
| Information Leakage | A design decision (a format, a business rule) is reflected in multiple modules. |
| Temporal Decomposition | Code structure follows execution order, not information hiding. |
| Overexposure | Using a common feature requires knowing about rarely-used ones. |
| Pass-Through Method | A method does nothing but forward its arguments to another method. |
| Repetition | The same (or near-same) code appears over and over. |
| Special-General Mixture | Special-purpose code isn't cleanly separated from general-purpose code. |
| Conjoined Methods | Understanding one method requires understanding another's implementation too. |
| Comment Repeats Code | The comment adds no information beyond what's obvious from the code next to it. |
| Implementation Documentation Contaminates Interface | An interface comment describes implementation details users don't need. |
| Vague Name | The name is too generic to convey what the thing actually is. |
| Hard to Pick Name | Can't find a precise, intuitive name — usually means the thing's definition is unclear. |
| Hard to Describe | A complete comment for this variable/method would have to be long. |
| Nonobvious Code | A quick read doesn't produce a correct guess about behavior. |

**15 design principles** (the positive checklist): complexity is incremental; working code isn't
enough; modules should be deep; interfaces should make common usage simple; a simple interface
matters more than a simple implementation; general-purpose modules are deeper; separate
general-purpose from special-purpose code; different layers should have different abstractions;
pull complexity downward; define errors out of existence; design it twice; comments should
describe what isn't obvious from the code; design for reading, not writing; increments of
development should be abstractions, not features; separate what matters from what doesn't and
emphasize what matters.

## Deliberately excluded (cited so it doesn't read as an oversight)

- **No blind function/file length or cyclomatic-complexity gate.** Ch. 9.8 is an explicit rebuttal
  of "functions should be short, split anything over N lines" (it's a direct response to *Clean
  Code*): *"Depth is more important than length: first make functions deep, then try to make them
  short enough to be easily read. Don't sacrifice depth for length."* Gating on length would
  impose exactly the philosophy this book argues against.
- **No test-coverage-percentage target.** Ch. 19.3–19.4: tests are valuable for the refactoring
  confidence they buy around *stable abstractions*, not as a vanity metric — and Ch. 19.4 is
  openly skeptical of test-driven development as too tactical/incremental a way to arrive at good
  design.
- **No speculative performance suggestions without a profile.** Ch. 20.2: "measure before, and
  after, modifying." An audit that guesses at what's slow is doing something this book explicitly
  warns against.

## The complexity-scoring formula (Ch. 2.1, implemented literally)

> "The overall complexity of a system is determined by the complexity of each part weighted by
> the fraction of time developers spend working on that part: C = Σ cp·tp. Isolating complexity
> in a place where it will never be seen is almost as good as eliminating it entirely."

`scripts/quality/quality-score.mjs` implements this directly instead of an invented severity
table:

- **tp** (time-weight) = percentile rank of per-file git commit count over the trailing 6 months
  (`scripts/quality/churn.mjs`) — the book's own proxy for "how much developer attention this
  file gets."
- **cp** (complexity-weight) = a weighted sum of percentile ranks: 0.4 × duplicated-token count
  (`jscpd`) + 0.3 × import fan-in (`madge` — Ch. 21's "centrality"/"leverage": how many other
  files depend on this one) + 0.3 × the file's red-flag count from the *previous* audit run.
  **Bootstrap case**: the first-ever run has no previous audit, so `cp` uses only duplication and
  fan-in (reweighted 0.55/0.45) until a real prior count exists.
- **score = cp × tp**, with one deliberate, named exception: any file under
  `src/lib/capital-circle/**`, `src/lib/ledger.ts`, or matching `*-actions.ts` has its score
  floor raised to at least the 75th percentile of that run — real-dollar blast radius matters
  even in code nobody has touched recently. This is the only folder-based override in the whole
  scoring model.
- **Severity bands** (fixed, not eyeballed per run): top decile of `score` = Critical, next 15% =
  High, next 25% = Medium, remainder = Low.

Every signal is combined by percentile rank within the current run's file set, not raw magnitude
— that's what makes a token count, an import count, and a flag count combinable without an
arbitrary unit conversion, and what makes the score reproducible for the same repo state.

## The two-speed loop

- **Per-PR (fast, deterministic, no LLM)**: `.github/workflows/quality.yml` runs `npm run
  typecheck`, `npm run lint`, and a circular-import check against a checked-in baseline
  (`docs/quality/circular-baseline.json`) as hard gates; jscpd and the commit-comment-ratio check
  run report-only. This is intentionally the *only* automatic thing that touches every PR — an
  LLM call in that hot path would make it slow, non-reproducible, and expensive for no benefit
  the deterministic checks don't already provide.
- **Weekly (deep, LLM-based)**: a scheduled agent runs `.claude/skills/code-quality-audit`
  full-sweep — see that file for the full procedure. Reviews the top 25 highest-scored,
  longest-unreviewed files each run, rotating the whole tree through over roughly 2–3 months.
  Writes `docs/quality/audit-<date>.md`, appends to `docs/quality/trend.md`, and files GitHub
  issues (label `code-quality`) for new Critical/High findings, opened as a PR rather than pushed
  directly.
- **Manual, on demand**: `/code-quality-audit diff` reviews only the current branch's changed
  files — never wired into CI, useful before opening a PR if you want the deeper review early.

## Files in this directory

- `raw/` — collector output (churn, jscpd, madge, pass-through/comment-overlap candidate lists,
  red-flag counts). Fully regenerable via `npm run quality:collect`; gitignored.
- `complexity-score.json` — the current ranked score; gitignored, regenerated on demand.
- `circular-baseline.json` — checked in deliberately: the reviewed snapshot the per-PR gate diffs
  new circular imports against.
- `audit-<date>.md` — one file per audit run; checked in, append-only history.
- `trend.md` — one row per run (counts, per-file review dates); checked in, the loop's memory.

## Manual commands

```bash
npm run quality:fast     # what the per-PR gate runs: lint, typecheck, circular-import check
npm run quality:collect  # all collectors + the score, in order
npm run quality:score    # just re-score from existing raw/ data
```

Then, in Claude Code: `/code-quality-audit diff` or `/code-quality-audit full-sweep`.
