---
name: liquid-subpill-return-summary
overview: Mirror the new "X% return on Portfolio" suffix into the Liquid sub-pill's collapsed summary so the rate is visible even when only the Liquid sub-pill is collapsed (without having to also collapse the parent Assets and Debt pill).
todos:
  - id: summary-fn
    content: Update `summarizeLiquidSubsection` in `PlannerForm.tsx` to append `· {percent} return on Portfolio` (em-dash kept for the zero-balance case).
    status: completed
  - id: tests
    content: Tighten the existing Liquid summary test to match the new suffix and add a new test pinning the em-dash + rate path for the empty-balance case.
    status: completed
  - id: lint-typecheck-test
    content: Run `npm run lint`, `npm run typecheck`, `npm test` and report results.
    status: in_progress
  - id: manual-verification-pause
    content: Pause for manual dev-server verification of the Liquid sub-pill summary and live slider update.
    status: pending
  - id: ship
    content: "After approval: branch, commit, push, open PR, wait for green CI, squash-merge, clean up branches."
    status: pending
isProject: false
---

# Liquid sub-pill summary: include expected return

## Scope

Tiny follow-on to the just-shipped "Net $X · 5.0% return on Portfolio" parent-pill change. Same suffix, same `percent()` formatter, same `·` separator — applied to the Liquid sub-pill summary so the rate stays discoverable while the parent pill is open but the Liquid sub-pill is closed.

Examples:

- Default plan (`startAssets = 10K`, `cashBalance = 0`, `nominalReturn = 0.05`): `$10,000 · 5.0% return on Portfolio`
- Empty liquid (`startAssets = 0`, `cashBalance = 0`): `— · 5.0% return on Portfolio` (em-dash kept as the "no balance" placeholder, rate always present — same convention as the parent pill, which always shows the rate even when net is 0)

## File-by-file changes

### 1. [app/src/features/planner/PlannerForm.tsx](app/src/features/planner/PlannerForm.tsx)

Update `summarizeLiquidSubsection` (lines 209-215) to append the rate. The Non-Liquid and Debt sub-pills are not touched (no rate associated with them).

```ts
function summarizeLiquidSubsection(
  v: PlanInputs,
  format: (n: number) => string
): string {
  const total = v.startAssets + v.cashBalance;
  const totalText = total > 0 ? format(total) : "—";
  return `${totalText} · ${percent(v.nominalReturn)} return on Portfolio`;
}
```

### 2. [app/src/features/planner/PlannerForm.test.tsx](app/src/features/planner/PlannerForm.test.tsx)

Two existing tests use `subsection-liquid-summary` and would otherwise pass anyway (one matches `/10,000/`, the other `not.toBe("—")`), but it is worth tightening to pin the new format:

- Lines 83-93 ("Liquid subsection shows a formatted total ..."): add `expect(summary.textContent).toMatch(/5\.0% return on Portfolio/)`.
- Lines 95-101 ("Non-Liquid subsection shows an em-dash ..."): confirm-not-changed (Non-Liquid summary still asserts exact `"—"`); no edit needed.

Add one new test pinning the empty-balance + rate path:

> "Liquid subsection summary keeps the return rate even when the bucket is empty"

Steps: render with `startAssets: 0, cashBalance: 0` (override `Host` or pass a custom value), confirm the Liquid summary text matches `/^— · 5\.0% return on Portfolio$/`.

## Out of scope (confirmed unchanged)

- `packages/core/` — no schema or projection logic changes.
- `docs/architecture.md`, `docs/plans/`, `.env.example`, `README.md`, `ROADMAP.md` — unchanged (UI copy only).
- Non-Liquid and Debt sub-pill summaries — no rate is associated with those buckets, so no change.
- Parent Assets and Debt pill summary — already shipped in the previous PR.

## Workflow

Per [.cursor/rules/workflow.mdc](.cursor/rules/workflow.mdc):

1. Make the changes above on a feature branch (this branch can either continue from the previous one if not yet shipped, or start fresh as `feat/liquid-subpill-return-summary`).
2. `npm run lint`, `npm run typecheck`, `npm test`.
3. Pause and ask you to dev-test in `npm run dev`. Specifically:
   - Expand Assets and Debt; collapse the Liquid sub-pill; pill reads `$10,000 · 5.0% return on Portfolio`.
   - Drag the Expected annual return slider and confirm both the Liquid sub-pill summary AND the parent Assets and Debt summary update live.
   - Zero out Financial Assets and Cash Balance; the Liquid summary now reads `— · 5.0% return on Portfolio`.
   - Non-Liquid and Debt sub-pill summaries are unchanged.
4. Wait for explicit "ship it" before committing, opening the PR, merging, and cleaning up branches.