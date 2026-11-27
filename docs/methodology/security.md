# Security methodology

Security takes precedence over enthusiasm, culture, landscapes, budget and novelty. No destination is risk-free; the requirement is operationalised through official advice for the **actual route**.

**Sources.** France Diplomatie (Conseils aux voyageurs), UK FCDO, Netherlands Worldwide, Australian Smartraveller and the US State Department, plus local authorities where relevant. Each assessment records the authorities actually read, their exact levels, the regions they cover, the date checked and what was *not* readable (several agencies' pages were unreachable from the research environment; this is stated per destination rather than guessed).

**Classification.**
- **Excluded** — the expedition concept needs areas under advice *against all travel* or *against all but essential travel* (France red/orange, FCDO, Netherlands red/orange), or is exposed to war, active armed conflict, or significant terrorism or kidnapping risk. Excluded destinations are shown as informational concepts only: no bookable-looking day-by-day plan.
- **Conditional** — significant uncertainty: official sources conflict, advice is changing, route restrictions are unresolved, regional spillover is live, or insurance cover is doubtful.
- **Eligible** — the reviewed advice shows no material conflict with the group's requirements on the assessed route.

Where a compliant variant preserved the expedition's identity, routes were redesigned to stay clear of restricted zones (and the change is explained in the destination's research note). Ordinary risks (road safety, petty crime, natural hazards) are reported separately and never confused with conflict risk.

**Effect on decisions.** Conditional and excluded destinations can be read and evaluated, but they never enter the eligible ranking, whatever their scores (enforced in `src/lib/statistics.ts` and in the backend's Results tab).

**Reassessment.** Every classification must be rechecked before booking and again shortly before departure; destination files list specific triggers. Cross-destination verification: `docs/verification/security-review.md`.
