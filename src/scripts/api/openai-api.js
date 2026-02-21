import { fetchWithRetry } from './api-utils.js';

export default class OpenAIAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async sendMessage(prompt, modelName) {
        return fetchWithRetry(async (signal) => {
            try {
                Logger.log('[OpenAI] Sending request to OpenAI API...');
                Logger.log('[OpenAI] === OPENAI API - FULL PROMPT ===');
                Logger.log(prompt);
                Logger.log('[OpenAI] === END PROMPT ===');

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
                    Logger.error('[OpenAI] API Response:', response.status, errorData);

                    let errorMessage = `API call failed: ${response.status}`;
                    try {
                        const jsonError = JSON.parse(errorData);
                        if (jsonError.error && jsonError.error.message) {
                            errorMessage = jsonError.error.message;
                        }
                    } catch (e) {
                        // fall back
                    }

                    if (response.status === 401) {
                        throw new Error(`Authentication Error: Invalid OpenAI API Key. Please check your settings.`);
                    } else if (response.status === 429) {
                        throw new Error(`Rate Limit Exceeded: Check your OpenAI plan and quotas.`);
                    } else if (response.status >= 500) {
                        throw new Error(`OpenAI Service Error: ${response.status}. The service might be currently unavailable.`);
                    }

                    throw new Error(errorMessage);
                }

                const data = await response.json();
                Logger.log('[OpenAI] OpenAI API response:', data);

                return {
                    content: data.choices[0].message.content,
                    usage: {
                        input_tokens: data.usage.prompt_tokens,
                        output_tokens: data.usage.completion_tokens
                    }
                };
            } catch (error) {
                Logger.error('[OpenAI] Error calling OpenAI API:', error);
                throw error;
            }
        });
    }

    async sendMessageStream(prompt, modelName, onChunk) {
        return fetchWithRetry(async (signal) => {
            try {
                Logger.log('[OpenAI] Sending stream request to OpenAI API...');
                Logger.log('[OpenAI] === OPENAI API STREAM - FULL PROMPT ===');
                Logger.log(prompt);
                Logger.log('[OpenAI] === END PROMPT ===');

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
                        stream: true,
                        stream_options: { include_usage: true }
                    }),
                    signal
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    Logger.error('[OpenAI] API Stream Response:', response.status, errorData);

                    let errorMessage = `API call failed: ${response.status}`;
                    try {
                        const jsonError = JSON.parse(errorData);
                        if (jsonError.error && jsonError.error.message) {
                            errorMessage = jsonError.error.message;
                        }
                    } catch (e) {
                        // fall back
                    }

                    if (response.status === 401) {
                        throw new Error(`Authentication Error: Invalid OpenAI API Key. Please check your settings.`);
                    } else if (response.status === 429) {
                        throw new Error(`Rate Limit Exceeded: Check your OpenAI plan and quotas.`);
                    } else if (response.status >= 500) {
                        throw new Error(`OpenAI Service Error: ${response.status}. The service might be currently unavailable.`);
                    }

                    throw new Error(errorMessage);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = '';
                let finalUsage = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

                    for (const line of lines) {
                        const data = line.replace(/^data:\s*/, '').trim();
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);

                            // Capture usage if it exists in the chunk
                            if (parsed.usage) {
                                finalUsage = {
                                    input_tokens: parsed.usage.prompt_tokens || 0,
                                    output_tokens: parsed.usage.completion_tokens || 0,
                                    total_tokens: parsed.usage.total_tokens || 0
                                };
                            }

                            const token = parsed.choices?.[0]?.delta?.content || '';
                            if (token) {
                                fullContent += token;
                                if (onChunk) onChunk(token);
                            }
                        } catch (e) {
                            // skip malformed
                        }
                    }
                }

                return {
                    content: fullContent,
                    usage: finalUsage
                };
            } catch (error) {
                Logger.error('[OpenAI] Error calling OpenAI API stream:', error);
                throw error;
            }
        });
    }
}

// Make the class available globally
