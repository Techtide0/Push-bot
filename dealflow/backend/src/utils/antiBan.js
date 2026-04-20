/**
 * Anti-ban utilities
 *
 * randomDelay  — waits a human-like random interval between sends
 * sendWithRetry — retries a failed send up to MAX_RETRIES times
 * RateLimiter   — enforces a maximum sends-per-minute ceiling
 */

const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS) || 2000;
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS) || 5000;
const MAX_RETRIES  = Number(process.env.MAX_RETRIES)  || 3;
const RETRY_BASE_MS = 2000; // base for exponential backoff

/** Wait a random amount between MIN_DELAY_MS and MAX_DELAY_MS */
function randomDelay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Attempt fn() up to MAX_RETRIES times with exponential backoff.
 * Throws the last error if all attempts fail.
 */
async function sendWithRetry(fn, context = '') {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const backoff = RETRY_BASE_MS * attempt;
      console.warn(`⚠️  Attempt ${attempt}/${MAX_RETRIES} failed${context ? ` (${context})` : ''}: ${err.message}. Retrying in ${backoff}ms…`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/**
 * Sliding-window rate limiter.
 * Tracks send timestamps and blocks until the rate is below the cap.
 *
 * Usage:
 *   const limiter = new RateLimiter(20); // max 20 per minute
 *   await limiter.throttle();
 */
class RateLimiter {
  constructor(maxPerMinute = 20) {
    this.maxPerMinute = maxPerMinute;
    this.timestamps = []; // rolling list of send times
  }

  async throttle() {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Drop timestamps older than 1 minute
    this.timestamps = this.timestamps.filter(t => t > windowStart);

    if (this.timestamps.length >= this.maxPerMinute) {
      // Wait until the oldest timestamp falls outside the window
      const oldest = this.timestamps[0];
      const wait = oldest + 60_000 - now + 100; // +100ms buffer
      console.log(`🛑 Rate limit reached (${this.maxPerMinute}/min). Pausing ${(wait / 1000).toFixed(1)}s…`);
      await new Promise(r => setTimeout(r, wait));
      // Recurse to re-check after waiting
      return this.throttle();
    }

    this.timestamps.push(Date.now());
  }
}

module.exports = { randomDelay, sendWithRetry, RateLimiter };
