# Comparing Dolphin With Other Tools

When asked to compare Dolphin with another project and suggest what to adopt, judge each idea by its net gain over what Dolphin _already_ does, weighed against what it costs in performance and tokens — that trade-off is Dolphin's focus.

- Map Dolphin's existing feature first (orchestration, Claude Agent Teams, subagents, injected terminal prompts, usage/rate-limit tracking, session search) and drop ideas it already covers or the agent CLIs already provide.
- Separate what the other project implements from what it only claims in its README.
- State the recurring cost of each idea: context tokens per session, plan quota, polling, IPC, or renderer work. Prefer zero-fixed-cost designs (on-demand, built from data already in memory).
- Assume subscription plans with quota limits, not per-token API billing, unless told otherwise.
- Recommend few ideas, ranked by gain/cost; say plainly when nothing is worth adopting.
