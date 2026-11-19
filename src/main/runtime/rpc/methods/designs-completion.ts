// `design.*` completion methods: the agent reports the approved design implemented, and only the
// user turns that into done (or sends back what is left).
import {
  DesignCompleteParams,
  DesignCompletionFileSchema,
  DesignConfirmDoneParams,
  DesignDeclineDoneParams
} from '../../../../shared/rpc-contract/design-params'
import { getDesignStore } from '../../../designs/design-store-instance'
import { defineMethod } from '../core'
import { refusing } from './designs-conversation'
import { parseDesignFile, requireBoundDesign, requireDesign } from './designs'

export const DESIGN_COMPLETION_METHODS = [
  defineMethod({
    name: 'design.complete',
    params: DesignCompleteParams,
    handler: (params, context) => {
      const design = requireBoundDesign(params.id, params.from, context)
      const { summary } = parseDesignFile(
        DesignCompletionFileSchema,
        params.completion,
        'design_invalid_completion',
        'Completion'
      )
      return { design: refusing(() => getDesignStore().complete(design.id, summary)) }
    }
  }),
  defineMethod({
    name: 'design.confirmDone',
    params: DesignConfirmDoneParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      return { design: refusing(() => getDesignStore().confirmDone(design.id)) }
    }
  }),
  defineMethod({
    name: 'design.declineDone',
    params: DesignDeclineDoneParams,
    handler: (params) => {
      const design = requireDesign(params.id)
      return { design: refusing(() => getDesignStore().declineDone(design.id, params.text)) }
    }
  })
]
