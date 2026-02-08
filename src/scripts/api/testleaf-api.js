// Logger presumed global from ../log.js

export default class TestleafAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.testleaf.com/ai/v1/chat/completions';
    }

    async sendMessage(prompt, modelName) {
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
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                Logger.error('API Response:', response.status, errorData);
                throw new Error(`API call failed: ${response.status} - ${errorData}`);
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
    }
}

// Make the class available globally
