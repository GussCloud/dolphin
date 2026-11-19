// The agent's side of an answered decision: recording that a later request changed it.
import { isDesignDecisionOpen, type Design, type DesignDecision } from '../../shared/design-types'
import { DesignRefusal, type DesignChange } from './design-interaction'

/** The agent records that the user's later request changed an answered decision. */
export function reviseDecision(
  design: Design,
  revision: { decisionId: string; text: string },
  at: number
): DesignChange<DesignDecision> {
  const decision = design.decisions.find((candidate) => candidate.id === revision.decisionId)
  if (!decision) {
    throw new DesignRefusal(
      'design_decision_not_found',
      `Decision ${revision.decisionId} is not on design ${design.id}.`
    )
  }
  if (isDesignDecisionOpen(decision)) {
    throw new DesignRefusal(
      'design_decision_not_answered',
      `Decision ${decision.id} has no answer yet; only an answered decision can be revised.`
    )
  }
  const revised: DesignDecision = { ...decision, revision: { text: revision.text, at } }
  return {
    patch: { decisions: design.decisions.map((d) => (d.id === decision.id ? revised : d)) },
    event: { kind: 'decision-revised', actor: 'agent', detail: decision.id },
    result: revised
  }
}
