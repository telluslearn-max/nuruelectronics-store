<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Code quality

Before considering a change done, `npm run quality:fast` should pass (typecheck, lint, circular-import
check — same as the per-PR gate). Full rubric and the weekly deep-review loop: `docs/quality/README.md`.
