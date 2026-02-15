export default class OpenAIAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async sendMessage(prompt, modelName) {
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
                })
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
    }
}

// Make the class available globally
