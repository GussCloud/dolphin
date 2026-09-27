import { Hono } from 'hono'
import type { AuthStore } from './store.js'

const MAX_FEEDBACK_BYTES = 8 * 1024 * 1024

/** Receives the desktop's feedback and crash reports (JSON or multipart) and keeps them in SQLite. */
export function feedbackRoutes(store: AuthStore) {
  const app = new Hono()
  app.post('/v1/feedback', async (c) => {
    const length = Number(c.req.header('content-length') ?? 0)
    if (length > MAX_FEEDBACK_BYTES) {
      return c.json({ ok: false, error: 'too_large' }, 413)
    }
    const contentType = c.req.header('content-type') ?? ''
    let fields: Record<string, unknown>
    if (contentType.includes('multipart/form-data')) {
      const form = await c.req.parseBody({ all: true })
      fields = {}
      for (const [name, value] of Object.entries(form)) {
        // Why text only: files (diagnostic bundles, screenshots) are summarized, not stored.
        fields[name] =
          value instanceof File ? { file: value.name, bytes: value.size, type: value.type } : value
      }
    } else {
      try {
        fields = (await c.req.json()) as Record<string, unknown>
      } catch {
        return c.json({ ok: false, error: 'invalid_body' }, 400)
      }
    }
    if (typeof fields.feedback !== 'string' || !fields.feedback.trim()) {
      return c.json({ ok: false, error: 'feedback_required' }, 400)
    }
    store.insertFeedback({
      submissionType: typeof fields.submissionType === 'string' ? fields.submissionType : null,
      appVersion: typeof fields.appVersion === 'string' ? fields.appVersion : null,
      platform: typeof fields.platform === 'string' ? fields.platform : null,
      body: JSON.stringify(fields)
    })
    return c.json({ ok: true, imagesDelivered: true })
  })
  return app
}
