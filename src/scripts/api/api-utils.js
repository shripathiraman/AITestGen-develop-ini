/**
 * Wraps an async fetch function with timeout + exponential backoff retry.
 * Handles rate limits and network errors smoothly to improve resilience.
 */
export async function fetchWithRetry(fn, { maxRetries = 3, timeoutMs = 20000 } = {}) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {

            // Pass the abort signal down to the fetch function
            const result = await fn(controller.signal);
            clearTimeout(timeout);
            return result;
        } catch (err) {
            clearTimeout(timeout);

            const isTimeout = err.name === 'AbortError';
            const isRateLimit = err.message?.includes('429') || err.message?.includes('Rate Limit');
            // Retry on arbitrary 5xx errors or network disconnection exceptions
            const isRetryable = isTimeout || isRateLimit || err.message?.includes('50') || err.message?.includes('network');

            if (attempt < maxRetries - 1 && isRetryable) {
                const delay = Math.pow(2, attempt) * 600; // 600ms, 1.2s, 2.4s
                Logger.warn(`[API] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                // If it's the last attempt and it failed via timeout:
                throw isTimeout ? new Error('Request timed out after 20s. The server might be busy or your connection dropped.') : err;
            }
        }
    }
}
