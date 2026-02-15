export default class GroqAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  // Helper function to extract the entire code block (including the delimiters)
  extractBlock(text) {
    // Matches a block that starts with ``` and ends with ```
    const regex = /(```[\s\S]*?```)/;
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : text;
  }

  async sendMessage(prompt, modelName) {
    try {
      Logger.log('[Groq] === GROQ API - FULL PROMPT ===');
      Logger.log(prompt);
      Logger.log('[Groq] === END PROMPT ===');

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
          temperature: 0.2,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        Logger.error('[Groq] API Response:', response.status, errorData);
        throw new Error(`API call failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      Logger.log('[Groq] Groq API response:', data);

      // Extract the entire code block (with ``` and closing ```)
      const rawContent = data.choices[0].message.content;
      const responseContent = this.extractBlock(rawContent);

      // Extract usage data
      const usage = data.usage ? {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      } : null;

      return {
        content: responseContent,
        usage: usage
      };
    } catch (error) {
      Logger.error('[Groq] Error calling Groq API:', error);
      throw error;
    }
  }
}
