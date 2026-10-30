## Working an issue

Work is an issue tree: #2 holds the agreed design, its sub-issues are epics, and each epic's sub-issues are leaves. **One leaf = one PR.**

1. Read the leaf, its parent epic and #2, then `GLOSSARY.md` and the ADRs touching the area. Commands: *Reading an issue's context* in `docs/agents/issue-tracker.md`.
2. Confirm every blocker is closed; if one is open, stop and report it.
3. Branch from fresh `main`, deliver the leaf's checklist, open a PR whose body says `Closes #<n>`. The owner merges.
4. If the work changes an agreed decision, say so in the PR and update #2, `GLOSSARY.md` or the ADR to match.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `stefan-stefanooov/simple-stock-history` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
