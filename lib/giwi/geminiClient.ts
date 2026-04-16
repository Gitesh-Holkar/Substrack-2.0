// lib/giwi/geminiClient.ts
//
// Shared Gemini API fetch wrapper used by all AI routes.
// Handles AbortController timeout, 503 retry, and consistent URL construction.
// Each route is responsible for its own request body and response parsing.

const RETRY_DELAY_MS = 2000
const DEFAULT_TIMEOUT_MS = 15000

function buildGeminiUrl(): string {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const key = process.env.GEMINI_API_KEY ?? ''
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
}

async function singleFetch(bodyStr: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(buildGeminiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: bodyStr,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Makes a POST request to the Gemini API.
 * Retries once after RETRY_DELAY_MS on 503 (server overload / high demand).
 * Does NOT retry on 429 (quota exhausted) or 400 (bad request) — those are
 * not transient errors and retrying immediately would waste quota or fail again.
 *
 * Returns the raw Response. Callers handle json() parsing and error checking.
 *
 * @param body   Request body object — will be JSON.stringified internally.
 * @param label  Short label used in console.warn for identifying which route retried.
 * @param timeoutMs  Per-attempt timeout in milliseconds. Defaults to 15000.
 */
export async function geminiPost(
  body: Record<string, unknown>,
  label: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const bodyStr = JSON.stringify(body)

  let res = await singleFetch(bodyStr, timeoutMs)

  if (res.status === 503) {
    console.warn(`[${label}] Model overloaded (503), retrying in ${RETRY_DELAY_MS}ms...`)
    await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    res = await singleFetch(bodyStr, timeoutMs)
  }

  return res
}
