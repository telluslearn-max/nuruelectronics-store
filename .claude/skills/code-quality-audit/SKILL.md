---
name: code-quality-audit
description: Deep design review of this codebase against the fixed rubric from "A Philosophy of Software Design" (Ousterhout) — the 14 named red flags and 15 design principles, never a free-form category. Two modes: "full-sweep" (top N files by docs/quality/complexity-score.json rank, not yet reviewed in the last 4 weeks — the automatic weekly trigger) and "diff" (files changed on the current branch — manual, on-demand, never wired into CI). Use when asked to run the quality audit, review code against the book's rubric, or do the weekly sweep.
argument-hint: "[full-sweep|diff]"
metadata:
  author: platform
  version: "1.0.0"
---

# Code Quality Audit

Runs a design review against the fixed rubric described in `docs/quality/README.md`, sourced
directly from *A Philosophy of Software Design* (Ousterhout, 2nd ed.). This skill is the deep,
qualitative half of the quality loop; `npm run quality:fast` and `.github/workflows/quality.yml`
are the fast, deterministic half that runs on every PR. **Never invoke this skill from CI** — it
makes LLM calls, which is exactly what the per-PR gate is deliberately kept free of.

## Before anything else

Read `docs/quality/README.md` in full if you haven't already this session — it has the complete
rubric (the 14 red flags, 15 principles), the scoring formula, and the explicit exclusions. Don't
re-derive any of that here; this file is the *procedure*, that file is the *rubric*.

## Step 1 — Collect

Run, in order (skip any that already ran in the last hour on this branch):

```bash
npm run quality:collect
```

This runs churn, the dependency graph, jscpd, the pass-through-file and comment-overlap
detectors, and `quality-score.mjs`, in that order, writing everything under `docs/quality/raw/`
and `docs/quality/complexity-score.json`. If `docs/quality/raw/red-flag-counts.json` doesn't
exist yet, the score is running in bootstrap mode (see the README) — that's expected on the very
first run and fine.

## Step 2 — Pick the review set

- **`full-sweep`** (the weekly automatic trigger): open `docs/quality/trend.md`, find each file's
  `lastReviewed` date (if the file has never been reviewed, treat it as due). Take the top **25**
  files from `docs/quality/complexity-score.json` that are either never-reviewed or last reviewed
  more than 4 weeks ago. If fewer than 25 qualify, fill the remainder with the next-highest-scored
  files regardless of recency, so a run never does less than 25 files. This bounds the cost of a
  run while rotating the whole ~430-file tree through over roughly 2–3 months, highest-leverage
  files first.
- **`diff`** (manual, on-demand): `git diff --name-only master...HEAD -- 'src/**/*.ts' 'src/**/*.tsx'`
  — review exactly those files, regardless of score.

Also pull in any file `docs/quality/raw/comment-overlap.json` flagged this run, and any file the
per-PR `check-commit-comment-ratio.mjs` warned about recently (visible in recent CI job summaries
if you have access, otherwise skip this part) — these are candidate lists other tools built for
you to judge, not files to skip just because they weren't in the top-25 by score.

## Step 3 — Review each file

For each file in the review set, read it in full (not an excerpt) and classify findings **only**
under one of the 14 named red flags from `docs/quality/README.md`. Never invent a category. A
file can have zero findings — that's a valid, useful outcome, not a failure to find something.

Specific rules to apply while reviewing, each because a naive pass would get it wrong:

1. **Never recommend splitting a function/file on length alone** (Ch. 9.8 — this book explicitly
   rebuts that philosophy). Only propose a split if it matches one of the two valid patterns: (a)
   factoring out a subtask that's independently understandable without the parent, or (b)
   dividing genuinely unrelated functionality into pieces each with a simpler interface than the
   original. If a proposed split would produce two pieces that can't be read independently of
   each other, that IS a finding — flag it as **Conjoined Methods** against the split, not the
   original code.
2. **Over-specialization is worth flagging even without a perfect-fit named red flag** (Ch. 6): if
   a module's interface reflects one specific caller's needs rather than the general capability it
   provides, classify it as **Shallow Module** or **Special-General Mixture**, whichever fits
   better, and say so explicitly in the finding.
3. **Design-it-twice requirement** (Ch. 11): if a finding implies restructuring a module (not a
   mechanical rename/merge/dedupe you could describe in one sentence), the finding must include
   **at least 2 alternative designs** with pros/cons before it's eligible to become a GitHub
   issue. Label these `needs-design-twice` in the report.
4. **No speculative performance advice** (Ch. 20.2 — "measure before, and after, modifying"): if
   you notice something that might be slow, that is out of scope for this audit unless you also
   have profiling evidence. Don't include it as a finding.
5. **Confirm or dismiss the two heuristic candidate lists** (`comment-overlap.json`, the
   `no-restricted-syntax` vague-name warnings) using the book's actual contextual tests — don't
   promote either into a finding just because the mechanical detector flagged it. Both are
   deliberately noisy (see `docs/quality/README.md`); your job here is to apply judgment they
   can't.
6. Severity is **not** a judgment call — read it directly off `docs/quality/complexity-score.json`
   for that file (`severity` field: Critical/High/Medium/Low). Don't override it.

## Step 4 — Write the report

Write `docs/quality/audit-<YYYY-MM-DD>.md`:

```markdown
# Code quality audit — <date>

Mode: full-sweep | diff
Files reviewed: <N>

## Findings

| File:Line | Red flag | Severity | Description | Fix / design options |
|---|---|---|---|---|
| ... | Shallow Module | High | ... | ... |

## Design-twice items

(any finding tagged needs-design-twice: full write-up per item, ≥2 alternatives with pros/cons)
```

Then append one row to `docs/quality/trend.md` (create it with a header row if it doesn't exist
yet):

```markdown
| Date | Mode | Files scanned | Critical | High | Medium | Low | Total findings |
|---|---|---|---|---|---|---|---|
```

...and update `docs/quality/raw/red-flag-counts.json` with `{ [file]: findingCount }` for every
file reviewed this run (create it if it's the first run) — this is what lets the *next* run's
`cp` term in the scoring formula include real red-flag data instead of running in bootstrap mode
forever. Also record each reviewed file's date in `docs/quality/trend.md` under a `## Last
reviewed` section (`file → date`) so Step 2 can find it next time.

## Step 5 — File issues for new Critical/High findings

For each finding at Critical or High severity that is genuinely new (check both `trend.md`'s
prior entries and `gh issue list --label code-quality --state open` to avoid duplicates):

```bash
gh issue create --title "<red flag>: <one-line description> (<file>)" \
  --label code-quality --label "red-flag:<category>" \
  [--label needs-design-twice] \
  --body "<finding detail, link to the report section>"
```

**Ask for confirmation before running `gh issue create` the first time in a session** — this
posts to GitHub, which is visible to others. After the first confirmed batch in a session, you
may continue filing further new Critical/High findings from the same run without re-asking,
since the user already approved the mechanism for this run.

## Step 6 — Weekly full-sweep only: open a PR

If running in `full-sweep` mode, commit the new/updated `docs/quality/audit-<date>.md`,
`docs/quality/trend.md`, and `docs/quality/raw/red-flag-counts.json` on a new branch and open a
PR titled `Weekly code quality audit — <date>`. Never push directly to `master`. `diff` mode does
not open a PR — it's meant to be read by the developer who ran it.

## Out of scope

- Performance suggestions without a profile (Ch. 20.2).
- Test-coverage-percentage targets (Ch. 19.3–19.4) — if a file needs a test to refactor safely,
  say so in the finding, but don't chase a coverage number.
- Anything not classifiable under the 14 named red flags — if you notice a real problem that
  genuinely doesn't fit any of them, say so in prose in the report rather than forcing it into the
  wrong category, but this should be rare.
