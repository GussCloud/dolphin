import {
  DEEPSEEK_MODELS_URL,
  type DeepSeekListModelsResult,
  type DeepSeekModelOption
} from '../../shared/deepseek-claude-provider'

const DEEPSEEK_MODELS_TIMEOUT_MS = 15_000

// Why: DeepSeek's `/models` is OpenAI-shaped and documents no context field; these are read only if present.
const CONTEXT_WINDOW_FIELDS = ['context_window', 'context_length', 'max_context_length'] as const

type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

function readContextWindow(entry: object): number | null {
  for (const field of CONTEXT_WINDOW_FIELDS) {
    const value: unknown = Reflect.get(entry, field)
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return null
}

export function parseDeepSeekModelsResponse(body: unknown): DeepSeekModelOption[] | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const data: unknown = Reflect.get(body, 'data')
  if (!Array.isArray(data)) {
    return null
  }
  const models: DeepSeekModelOption[] = []
  const seen = new Set<string>()
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const id: unknown = Reflect.get(entry, 'id')
    if (typeof id !== 'string' || !id.trim() || seen.has(id.trim())) {
      continue
    }
    seen.add(id.trim())
    models.push({ id: id.trim(), contextWindow: readContextWindow(entry) })
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
