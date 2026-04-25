// lib/ratelimit.ts
//
// Upstash rate limiters for GIWI chat.
// Two limiters:
//   giwiDailyLimiter   — 100 messages per merchant per day (shown in UI)
//   giwiMinuteLimiter  — 20 messages per merchant per minute (silent, abuse protection)
//
// Both use sliding window algorithm.
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from environment.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Daily GIWI rate limiter — 100 messages per merchant per day.
 * Remaining count and reset timestamp are returned to the client via response headers
 * and displayed in the GIWI usage indicator.
 */
export const giwiDailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 d'),
  prefix: 'substrack:giwi:daily',
})

/**
 * Per-minute GIWI rate limiter — 20 messages per merchant per minute.
 * Silent — never shown in UI. Only surfaces as a brief inline message.
 * Prevents automated abuse without disrupting normal usage.
 */
export const giwiMinuteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'substrack:giwi:minute',
})
