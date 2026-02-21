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

                return {
                    content: data.transaction.response.choices[0].message.content,
                    usage: {
                        input_tokens: data.transaction.response.usage.prompt_tokens,
                        output_tokens: data.transaction.response.usage.completion_tokens
                    }
                };
            } catch (error) {
                Logger.error('Error calling Testleaf API:', error);
                throw error;
            }
        });
    }
}

// Make the class available globally
