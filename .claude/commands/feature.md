---
description: Run a Zamin feature or bugfix through the engineer-team pipeline (plan → implement → test → security), coordinating the sub-agents.
---

Act as the **orchestrator** of the Zamin engineering team to deliver the request below. Do NOT do it all yourself — delegate briefs to the specialist sub-agents and relay results between them. Spawn agents only as each stage needs them (cold starts are costly).

Request: $ARGUMENTS

Pipeline:
1. **Plan** — spawn `zamin-planner` with the request. Get back the step-by-step plan + ripple checklist + security/UI flags. If the approach is non-obvious or risky, share the plan with me before proceeding.
2. **Implement** — hand the planner's brief to `zamin-coder` (logic/API/DB) and/or `zamin-ui` (visual/layout). They follow CLAUDE.md (ripple trace + CHANGELOG + docs). Run them in parallel only if their files don't overlap.
3. **Test** — hand the "what changed + how to verify" brief to `zamin-tester`. It smoke-tests the change, runs a regression pass, and reports pass/fail with evidence.
4. **Security** — if the change touched auth / input / data-exposure / uploads / payments / external calls, hand it to `zamin-security`; route its fixes back through `zamin-coder`.
5. **Close** — confirm CHANGELOG + docs are updated; summarize what changed, what was verified, and any follow-ups.

Give me a short status after each stage. If a stage fails, loop back to the right agent instead of pushing forward.
