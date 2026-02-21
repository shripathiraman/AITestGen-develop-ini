# API Integration Guide

This guide explains how to add new Large Language Model (LLM) providers to the AI Test Case Generator extension.

## Overview

The extension uses a modular API system located in `src/scripts/api/`. Each provider is implemented as a separate class that handles authentication and message sending.

## Step-by-Step Integration

### 1. Create the API Class

Create a new file in `src/scripts/api/` (e.g., `my-new-provider.js`). The class must implement a `sendMessage` method.

**Template:**

```javascript
export default class MyNewProviderAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.provider.com/v1/chat/completions';
  }

  /**
   * Sends a prompt to the LLM and returns the response.
   * @param {string} prompt - The prompt text.
   * @param {string} modelName - The specific model to use.
   * @returns {Promise<{content: string, usage: {input_tokens: number, output_tokens: number}}>}
   */
  async sendMessage(prompt, modelName) {
    try {
      Logger.log('[MyProvider] Sending message...');
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices[0].message.content, // Adjust based on API structure
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        }
      };
      
    } catch (error) {
      Logger.error('[MyProvider] Error:', error);
      throw error;
    }
  }
}
```

### 2. Register the Provider in Code Generator

Open `src/sidepanel/codegenerate.js` and import your new class.

1.  **Import the class:**
    ```javascript
    import MyNewProviderAPI from '../scripts/api/my-new-provider.js';
    ```

2.  **Instantiate based on settings:**
    Locate the `handleGenerateClick` method and find where `api` is initialized (around line 191). Add your provider to the logic:

    ```javascript
    // Select API Provider
    let api;
    if (settings.llmProvider === 'groq') api = new GroqAPI(apiKey);
    else if (settings.llmProvider === 'openai') api = new OpenAIAPI(apiKey);
    else if (settings.llmProvider === 'myprovider') api = new MyNewProviderAPI(apiKey); // Add this
    else api = new TestleafAPI(apiKey);
    ```

### 3. Update the UI Configuration

The extension loads dropdown options dynamically from `src/data/dropdown-data.json`. You need to add your new provider and its models there.

1.  Open `src/data/dropdown-data.json`.
2.  Add your provider to the `llmProviders` array:
    ```json
    "llmProviders": [
      {
        "code": "openai",
        "description": "OpenAI"
      },
      {
        "code": "myprovider",
        "description": "My New Provider"
      }
    ]
    ```
3.  Add your supported models to the `llmModels` object, using your provider code as the key:
    ```json
    "llmModels": {
      "openai": [...],
      "myprovider": [
        {
          "code": "model-v1",
          "description": "Model V1"
        }
      ]
    }
    ```

*Note: The `src/sidepanel/settings.js` script automatically fetches this file and populates the dropdowns.*

## Implementation Details

- **Locators:** Note that the `prompt` payload sent to the LLMs includes structured, pre-computed locators that resolve to reliable strategies (Shadow DOM capabilities, fallback chains, resilience scoring, etc.) explicitly evaluated locally in `content.js`. This allows relying directly on the provided data within prompts to drastically reduce LLM hallucination.
- **Logger:** Use the global `Logger` utility for debugging.
- **Error Handling:** Ensure `sendMessage` throws meaningful errors. The `CodeGenerator` class will catch these and display them to the user using the dedicated `showApiError` modal.
- **Usage Stats:** Always return a `usage` object with `input_tokens` and `output_tokens` from `sendMessage`. This powers the token usage & latency stats display in the UI.
