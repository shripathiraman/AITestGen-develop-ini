// Logger presumed global from ../log.js
import { fetchWithRetry } from './api-utils.js';

export default class TestleafAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.testleaf.com/ai/v1/chat/completions';
    }

    async sendMessage(prompt, modelName) {
        return fetchWithRetry(async (signal) => {
            try {
                Logger.log('Sending request to Testleaf API...');
                Logger.log('Request >> ' + prompt);

                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [{
                            role: 'user',
                            content: prompt
                        }],
                        max_completion_tokens: 4096
                    }),
                    signal
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    Logger.error('API Response:', response.status, errorData);

                    let errorMessage = `API call failed: ${response.status}`;
                    try {
                        const jsonError = JSON.parse(errorData);
                        // Adjust based on Testleaf's actual error structure if known, assuming standard for now
                        if (jsonError.error && jsonError.error.message) {
                            errorMessage = jsonError.error.message;
                        } else if (jsonError.message) {
                            errorMessage = jsonError.message;
                        }
                    } catch (e) {
                        // fall back
                    }

                    if (response.status === 401) {
                        throw new Error(`Authentication Error: Invalid Testleaf API Key. Please check your settings.`);
                    } else if (response.status === 429) {
                        throw new Error(`Rate Limit Exceeded: You are sending requests too quickly.`);
                    } else if (response.status >= 500) {
                        throw new Error(`Testleaf Service Error: ${response.status}. The service might be currently unavailable.`);
                    }

                    throw new Error(errorMessage);
                }

                const data = await response.json();
                Logger.log('Testleaf API response:', data);

                const transactionResponse = data?.transaction?.response;
                if (!transactionResponse) {
                    throw new Error('Unexpected Testleaf response structure: Missing transaction.response');
                }

                return {
                    content: transactionResponse.choices?.[0]?.message?.content ?? '',
                    usage: {
                        input_tokens: transactionResponse.usage?.prompt_tokens ?? 0,
                        output_tokens: transactionResponse.usage?.completion_tokens ?? 0
                    }
                };
            } catch (error) {
                Logger.error('Error calling Testleaf API:', error);
                throw error;
            }
        });
    }

    async sendMessageStream(prompt, modelName, onChunk) {
        return fetchWithRetry(async (signal) => {
            try {
                Logger.log('[Testleaf] Starting streaming request...');

                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [{
                            role: 'user',
                            content: prompt
                        }],
                        max_completion_tokens: 4096,
                        stream: true
                    }),
                    signal
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    Logger.error('[Testleaf] Stream error:', response.status, errorData);

                    let errorMessage = `API call failed: ${response.status}`;
                    try {
                        const jsonError = JSON.parse(errorData);
                        if (jsonError.error && jsonError.error.message) errorMessage = jsonError.error.message;
                        else if (jsonError.message) errorMessage = jsonError.message;
                    } catch (e) { /* use raw status */ }

                    if (response.status === 401) throw new Error('Authentication Error: Invalid Testleaf API Key. Please check your settings.');
                    if (response.status === 429) throw new Error('Rate Limit Exceeded: You are sending requests too quickly.');
                    if (response.status >= 500) throw new Error(`Testleaf Service Error: ${response.status}. The service might be unavailable.`);
                    throw new Error(errorMessage);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = '';
                let finalUsage = null;
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    // Keep incomplete last line in buffer
                    buffer = lines.pop();

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;

                        const data = trimmed.replace(/^data:\s*/, '');
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            // Accumulate usage if present (final chunk)
                            if (parsed.usage) {
                                finalUsage = {
                                    input_tokens: parsed.usage.prompt_tokens ?? 0,
                                    output_tokens: parsed.usage.completion_tokens ?? 0,
                                    total_tokens: parsed.usage.total_tokens ?? 0
                                };
                            }

                            // Standard OpenAI-compatible delta
                            const token = parsed.choices?.[0]?.delta?.content || '';
                            if (token) {
                                fullContent += token;
                                if (onChunk) onChunk(token);
                            }

                            // Testleaf non-streaming envelope fallback (if server ignores stream:true)
                            if (!token && parsed.transaction?.response) {
                                const tc = parsed.transaction.response.choices?.[0]?.message?.content ?? '';
                                if (tc) {
                                    fullContent += tc;
                                    if (onChunk) onChunk(tc);
                                    finalUsage = {
                                        input_tokens: parsed.transaction.response.usage?.prompt_tokens ?? 0,
                                        output_tokens: parsed.transaction.response.usage?.completion_tokens ?? 0
                                    };
                                }
                            }
                        } catch (e) {
                            // skip malformed SSE chunk
                        }
                    }
                }

                Logger.log('[Testleaf] Stream complete. Total chars:', fullContent.length);
                return { content: fullContent, usage: finalUsage };
            } catch (error) {
                Logger.error('[Testleaf] Error during streaming:', error);
                throw error;
            }
        });
    }
}

// Make the class available globally
