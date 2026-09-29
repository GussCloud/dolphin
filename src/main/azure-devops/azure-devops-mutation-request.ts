import { HostedReviewApiRequestError } from '../source-control/hosted-review-api-request'
import {
  azureDevOpsApiVersionForOrigin,
  isAzureDevOpsPreviewVersionRejection,
  markAzureDevOpsPreviewApiVersionOrigin
} from './azure-devops-api-request'
import { resolveAzureDevOpsAuthHeaders } from './azure-devops-credential'

const MUTATION_TIMEOUT_MS = 30_000

type AzureDevOpsSendOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  searchParams?: Record<string, string | number>
  apiVersion?: string
}

function buildUrl(baseUrl: string, path: string, options: AzureDevOpsSendOptions): URL {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`)
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(key, String(value))
  }
  url.searchParams.set(
    'api-version',
    azureDevOpsApiVersionForOrigin(url.origin, options.apiVersion)
  )
  return url
}

async function send(url: URL, options: AzureDevOpsSendOptions): Promise<Response> {
  return fetch(url, {
    method: options.method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(await resolveAzureDevOpsAuthHeaders())
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS)
  })
}

function errorMessage(status: number, body: string): string {
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      const { message } = parsed
      if (typeof message === 'string' && message) {
        return message
      }
    }
  } catch {
    // Non-JSON bodies (HTML sign-in pages) fall through to the status line.
  }
  return `Azure DevOps request failed: HTTP ${status}`
}

/**
 * Sends a request whose failure must reach the caller: throws `HostedReviewApiRequestError`
 * with Azure DevOps' own message. Returns null for an empty (204) response.
 */
export async function sendAzureDevOpsRequest(
  baseUrl: string,
  path: string,
  options: AzureDevOpsSendOptions
): Promise<unknown> {
  try {
    let url = buildUrl(baseUrl, path, options)
    let response = await send(url, options)
    let text = await response.text()
    // Why (STA-3494): Azure DevOps Server rejects the request before acting on it,
    // so one retry with -preview is safe even for mutations.
    if (
      !url.searchParams.get('api-version')?.endsWith('-preview') &&
      isAzureDevOpsPreviewVersionRejection(response.status, text)
    ) {
      markAzureDevOpsPreviewApiVersionOrigin(url.origin)
      url = buildUrl(baseUrl, path, options)
      response = await send(url, options)
      text = await response.text()
    }
    if (!response.ok) {
      throw new HostedReviewApiRequestError(errorMessage(response.status, text), {
        status: response.status
      })
    }
    // Why: an expired sign-in redirects to an HTML page with 203, not a 401.
    if (response.status === 203) {
      throw new HostedReviewApiRequestError('Azure DevOps is not authenticated', { status: 401 })
    }
    return text.trim() ? JSON.parse(text) : null
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new HostedReviewApiRequestError('Request timed out', { timedOut: true })
    }
    throw error
  }
}
