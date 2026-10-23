import { z } from 'zod'
import {
  DEEPSEEK_MODELS_URL,
  type DeepSeekListModelsResult,
  type DeepSeekModelOption
} from '../../shared/deepseek-claude-provider'

const DEEPSEEK_MODELS_TIMEOUT_MS = 15_000

// Why: DeepSeek's `/models` is OpenAI-shaped and documents no context field; these are read only if present.
const positiveNumber = z.number().finite().positive()
const modelEntrySchema = z.object({
  id: z.string(),
  context_window: positiveNumber.optional().catch(undefined),
  context_length: positiveNumber.optional().catch(undefined),
  max_context_length: positiveNumber.optional().catch(undefined)
})
const modelsResponseSchema = z.object({ data: z.array(z.unknown()) })

type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export function parseDeepSeekModelsResponse(body: unknown): DeepSeekModelOption[] | null {
  const response = modelsResponseSchema.safeParse(body)
  if (!response.success) {
    return null
  }
  const models: DeepSeekModelOption[] = []
  const seen = new Set<string>()
  for (const raw of response.data.data) {
    const entry = modelEntrySchema.safeParse(raw)
    const id = entry.success ? entry.data.id.trim() : ''
    if (!entry.success || !id || seen.has(id)) {
      continue
    }
    seen.add(id)
    const { context_window, context_length, max_context_length } = entry.data
    models.push({
      id,
      contextWindow: context_window ?? context_length ?? max_context_length ?? null
    })
  }
  return models
}

export async function requestDeepSeekModels(
  apiKey: string,
  fetchImpl: FetchLike
): Promise<DeepSeekListModelsResult> {
  let response: Awaited<ReturnType<FetchLike>>
  try {
    response = await fetchImpl(DEEPSEEK_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(DEEPSEEK_MODELS_TIMEOUT_MS)
    })
  } catch (error) {
    console.warn('[deepseek] failed to reach the models endpoint', error)
    return { ok: false, reason: 'network' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'unauthorized' }
  }
  if (!response.ok) {
    console.warn(`[deepseek] models endpoint answered HTTP ${response.status}`)
    return { ok: false, reason: 'network' }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'invalid-response' }
  }
  const models = parseDeepSeekModelsResponse(body)
  return models ? { ok: true, models } : { ok: false, reason: 'invalid-response' }
}
