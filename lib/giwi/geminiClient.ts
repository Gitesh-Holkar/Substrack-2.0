// lib/giwi/geminiClient.ts
//
// Shared Gemini API fetch wrapper used by all AI routes.
// Implements a two-level fallback cascade for 503 (server overload) errors:
//
//   Primary (GEMINI_MODEL)
//     -> 503: retry once after RETRY_DELAY_MS
//     -> still 503: try Fallback 1 (GEMINI_FALLBACK_MODEL_1)
//       -> 503: try Fallback 2 (GEMINI_FALLBACK_MODEL_2)
//         -> 503: return 503 - all models overloaded
//
// Non-503 errors (429, 400, network timeout) stop immediately - they are not
// transient and switching models will not resolve them.
//
// Environment variables:
//   GEMINI_MODEL              - primary model (required)
//   GEMINI_FALLBACK_MODEL_1   - first fallback (optional)
//   GEMINI_FALLBACK_MODEL_2   - second fallback (optional)
//   GEMINI_API_KEY            - API key (required)

const RETRY_DELAY_MS = 2000
const DEFAULT_TIMEOUT_MS = 15000

function buildGeminiUrl(model: string): string {
  const key = process.env.GEMINI_API_KEY ?? ''
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
}

async function singleFetch(
  bodyStr: string,
  timeoutMs: number,
  model: string
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(buildGeminiUrl(model), {
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
 * Makes a POST request to the Gemini API with a two-level fallback cascade.
 *
 * Flow:
 *   1. Try primary model (GEMINI_MODEL)
 *   2. On 503 -> wait RETRY_DELAY_MS -> retry primary once more
 *   3. On 503 again -> try GEMINI_FALLBACK_MODEL_1 immediately (no wait)
 *   4. On 503 again -> try GEMINI_FALLBACK_MODEL_2 immediately (no wait)
 *   5. If all fail with 503 -> return the last 503 response
 *
 * Any non-503 response at any stage is returned immediately without further
 * fallback attempts. This includes 200 (success), 429 (quota), 400 (bad request).
 *
 * Returns the raw Response. Callers handle json() parsing and error checking.
 *
 * @param body      Request body object - will be JSON.stringified internally.
 * @param label     Short label for console logs identifying which route is calling.
 * @param timeoutMs Per-attempt timeout in milliseconds. Defaults to 15000.
 */
export async function geminiPost(
  body: Record<string, unknown>,
  label: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const primaryModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const fallback1 = process.env.GEMINI_FALLBACK_MODEL_1 ?? ''
  const fallback2 = process.env.GEMINI_FALLBACK_MODEL_2 ?? ''
  const bodyStr = JSON.stringify(body)

  // tryFetch wraps singleFetch so that timeouts and network errors return null
  // instead of throwing. Without this, an AbortController timeout exception
  // escapes geminiPost entirely and the fallback models never get tried.
  async function tryFetch(model: string): Promise<Response | null> {
    try {
      return await singleFetch(bodyStr, timeoutMs, model)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[${label}] ${model} fetch threw: ${reason}`)
      return null
    }
  }

  // Convenience: true when we should continue to the next fallback
  function shouldFallback(r: Response | null): boolean {
    return r === null || r.status === 503
  }

  // Attempt 1: Primary model
  let res = await tryFetch(primaryModel)
  if (!shouldFallback(res)) return res!

  // Attempt 2: Retry primary after delay
  const reason1 = res === null ? 'timeout' : '503'
  console.warn(
    `[${label}] ${primaryModel} unavailable (${reason1}), retrying in ${RETRY_DELAY_MS}ms...`
  )
  await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  res = await tryFetch(primaryModel)
  if (!shouldFallback(res)) return res!

  // Attempt 3: Fallback model 1
  if (fallback1) {
    const reason2 = res === null ? 'timeout' : '503'
    console.warn(
      `[${label}] ${primaryModel} still unavailable (${reason2}) - switching to fallback 1: ${fallback1}`
    )
    res = await tryFetch(fallback1)
    if (!shouldFallback(res)) return res!

    // Attempt 4: Fallback model 2
    if (fallback2) {
      const reason3 = res === null ? 'timeout' : '503'
      console.warn(
        `[${label}] ${fallback1} unavailable (${reason3}) - switching to fallback 2: ${fallback2}`
      )
      res = await tryFetch(fallback2)
      if (!shouldFallback(res)) return res!

      console.error(
        `[${label}] All models unavailable. Primary: ${primaryModel}, Fallback 1: ${fallback1}, Fallback 2: ${fallback2}`
      )
      return (
        res ??
        new Response(JSON.stringify({ error: 'All AI models are currently unavailable.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }

    // Fallback 2 not configured
    console.warn(`[${label}] ${fallback1} unavailable and GEMINI_FALLBACK_MODEL_2 is not set`)
    return (
      res ??
      new Response(JSON.stringify({ error: 'AI model unavailable.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }

  // Fallback 1 not configured
  console.warn(`[${label}] ${primaryModel} unavailable and GEMINI_FALLBACK_MODEL_1 is not set`)
  return (
    res ??
    new Response(JSON.stringify({ error: 'AI model unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}
