# Zamin — the engineering "team" (Claude Code sub-agents)

A lightweight engineering team modelled as Claude Code **custom sub-agents**, so a growing, complex
project can be split by role instead of one session doing everything.

## How it actually works (read this — it shapes expectations)
- **One orchestrator + specialist sub-agents.** The main Claude session is the orchestrator. It spawns
  a specialist via the Agent tool, hands it a **brief** (a prompt), and gets back a single final report.
- Sub-agents are **cold-start and stateless** — each spawn re-derives context from scratch, so they're
  worth it for genuinely complex or parallelisable work, not trivial edits.
- They do **not** chat peer-to-peer. The orchestrator coordinates: it passes one agent's output to the
  next as its brief. (You can continue a *specific* agent with its context intact via a follow-up
  message rather than a fresh spawn.)
- **Shared understanding = the repo.** Every agent auto-loads `CLAUDE.md` and reads the docs it needs
  (`ARCHITECTURE.md`, `ROADMAP.md`, `BUGLOG.md`, `vibe-check/`). Keeping those current is what keeps the
  whole team aligned — the docs ARE the team's memory.

## The roles (`.claude/agents/`)
| Agent | Role | Edits code? | Model |
|-------|------|-------------|-------|
| `zamin-planner` | Architect — turns a request into a ripple-aware plan + validation steps | No (read-only) | opus |
| `zamin-coder` | Implementer — logic/API/DB, follows the ripple + changelog workflow | Yes | inherits |
| `zamin-ui` | UI / design-system — platform-adaptive visuals, verifies on simulators | Yes | inherits |
| `zamin-tester` | QA — bundle/API/simulator smoke + regression, honest pass/fail | No | sonnet |
| `zamin-security` | Security reviewer — vibe-check rules, data-exposure, auth | No (reports) | opus |

## How to use it
- **Whole pipeline:** `/feature <describe the feature or bug>` — runs plan → implement → test → security
  and keeps you in the loop after each stage.
- **One specialist:** e.g. "use the zamin-tester subagent to smoke-test the saved-search flow", or
  "have zamin-security review the pending diff".
- The orchestrator loops back to the right agent on failure instead of pushing forward.

## The engineer's loop (what the team encodes)
Plan (trace the ripple; flag security + UI) → Implement (match the codebase; propagate denormalized
copies) → Validate (compile / curl / screenshot, from the *consumer's* perspective) → Secure (review
auth / input / exposure) → Track (CHANGELOG + docs). **Security and testing run on every feature — new
and old.**

## Extending the team
Add a role by dropping a new `.claude/agents/<name>.md`:
```
---
name: <kebab-name>
description: <when the orchestrator should use it>
tools: Read, Grep, Glob, Bash   # optional; omit = inherit all. Restrict for read-only roles.
model: opus | sonnet | haiku    # optional; deep reasoning → opus, routine runs → sonnet
---
<focused system prompt that points at the relevant docs + rules>
```
Keep each agent narrow and grounded in the docs. Update this table and `CLAUDE.md` when you add one.
