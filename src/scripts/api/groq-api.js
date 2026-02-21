import { fetchWithRetry } from './api-utils.js';

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
    return fetchWithRetry(async (signal) => {
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
          }),
          signal
        });

        if (!response.ok) {
          const errorData = await response.text();
          Logger.error('[Groq] API Response:', response.status, errorData);

          let errorMessage = `API call failed: ${response.status}`;
          try {
            const jsonError = JSON.parse(errorData);
            if (jsonError.error && jsonError.error.message) {
              errorMessage = jsonError.error.message;
            }
          } catch (e) {
            // If response is not JSON, use the raw text or status
          }

          // Map common status codes to user-friendly messages
          if (response.status === 401) {
            throw new Error(`Authentication Error: Invalid API Key. Please check your settings.`);
          } else if (response.status === 429) {
            throw new Error(`Rate Limit Exceeded: You are sending requests too quickly. Please wait a moment.`);
          } else if (response.status >= 500) {
            throw new Error(`Groq Service Error: ${response.status}. The service might be currently unavailable.`);
          }

          throw new Error(errorMessage);
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
    });
  }

  async sendMessageStream(prompt, modelName, onChunk) {
    return fetchWithRetry(async (signal) => {
      try {
        Logger.log('[Groq] === GROQ API STREAM - FULL PROMPT ===');
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
            max_tokens: 8000,
            stream: true,
            stream_options: { include_usage: true }
          }),
          signal
        });

        if (!response.ok) {
          const errorData = await response.text();
          Logger.error('[Groq] API Stream Response Error:', response.status, errorData);

          let errorMessage = `API call failed: ${response.status}`;
          try {
            const jsonError = JSON.parse(errorData);
            if (jsonError.error && jsonError.error.message) {
              errorMessage = jsonError.error.message;
            }
          } catch (e) {
            // If response is not JSON, use the raw text or status
          }

          if (response.status === 401) {
            throw new Error(`Authentication Error: Invalid API Key. Please check your settings.`);
          } else if (response.status === 429) {
            throw new Error(`Rate Limit Exceeded: You are sending requests too quickly. Please wait a moment.`);
          } else if (response.status >= 500) {
            throw new Error(`Groq Service Error: ${response.status}. The service might be currently unavailable.`);
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

              // Extract usage if available (Groq might send usage directly or via x_groq)
              if (parsed.usage) {
                finalUsage = {
                  input_tokens: parsed.usage.prompt_tokens || 0,
                  output_tokens: parsed.usage.completion_tokens || 0,
                  total_tokens: parsed.usage.total_tokens || 0
                };
              } else if (parsed.x_groq && parsed.x_groq.usage) {
                finalUsage = {
                  input_tokens: parsed.x_groq.usage.prompt_tokens || 0,
                  output_tokens: parsed.x_groq.usage.completion_tokens || 0,
                  total_tokens: parsed.x_groq.usage.total_tokens || 0
                };
              }

              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                fullContent += token;
                if (onChunk) onChunk(token);
              }
            } catch (e) {
              // skip malformed chunks
            }
          }
        }

        return {
          content: fullContent,
          usage: finalUsage
        };
      } catch (error) {
        Logger.error('[Groq] Error calling Groq API stream:', error);
        throw error;
      }
    });
  }
}
