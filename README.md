# Ledger

Personal zero-based budgeting app. See `PROJECT_BRIEF.md` for the product spec and build plan, `CLAUDE.md` for the accounting rules Claude Code should treat as non-negotiable.

## Setup

1. **Create the GitHub repo**
   ```
   gh repo create ledger --private --clone
   cd ledger
   ```
   (or create it on github.com and `git clone` locally — whatever you did for trading-operating-system.)

2. **Copy these three files into the repo root**: `CLAUDE.md`, `PROJECT_BRIEF.md`, `README.md`.

3. **Set up Neon Postgres**
   - New project at neon.tech (same account/workflow you used for Tradeops if you want them together, or a separate project to keep this fully isolated from trading data — separate is probably cleaner).
   - Copy the connection string into a local `.env` (don't commit it — add `.env` to `.gitignore` immediately).

4. **Commit the seed files**
   ```
   git add CLAUDE.md PROJECT_BRIEF.md README.md .gitignore
   git commit -m "Project seed: brief and accounting rules"
   git push
   ```

5. **Run Claude Code in the repo directory**
   ```
   claude
   ```
   Then point it at the brief, e.g.: *"Read CLAUDE.md and PROJECT_BRIEF.md, then start with Phase 1 — plan and confirm the data model before writing any code."*

Follow the build order in `PROJECT_BRIEF.md` phase by phase, letting Claude Code confirm the data model and get the accounting engine's tests passing before any UI work — same discipline as the Replit prompt, just running locally instead of costing Replit credits.
