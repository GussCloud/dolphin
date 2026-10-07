import { transportText } from './transport-text'

export function hostEndpointLabel(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    if (!url.hostname) {
      return transportText('unknownEndpoint')
    }
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`
  } catch {
    return transportText('unknownEndpoint')
  }
}
