# AI Test Case Generator (Chrome Extension)

🚀 **Generate Test Cases, Scripts & Page Objects Instantly from your Browser!**

The **AI Test Case Generator** is a powerful Chrome Extension designed to streamline the QA process. By simply inspecting elements on a webpage, you can use advanced AI (Groq, OpenAI, or Testleaf) to automatically generate professional Test Cases, Gherkin Feature Files, Automation Scripts, and Page Object Models (POM).

## ✨ Key Features

*   **🔍 Interactive Element Inspection**: Point and click to select elements directly on any webpage.
*   **🤖 Multi-LLM Support**: Choose your preferred AI provider:
    *   **Groq**: Fast and efficient.
    *   **OpenAI (GPT)**: Industry-leading reasoning.
    *   **Testleaf**: Specialized for testing contexts.
*   **📝 Versatile Output Formats**:
    *   **Manual Test Cases**: Structured step-by-step instructions.
    *   **Gherkin / Cucumber**: Ready-to-use `.feature` files for BDD.
*   **💻 Automation Code Generation**:
    *   **Frameworks**: Playwright, Selenium.
    *   **Languages**: TypeScript, Java, JavaScript, Python.
    *   **Page Object Model (POM)**: Generates reusable page classes automatically.
*   **⚡ Parallel Generation**: Generate Test Cases and Automation Scripts simultaneously to save time.
*   **📂 Multi-Page Support**: Capture elements across different pages for complex workflows.

---

## 🚀 How to Use

### 1. Installation
1.  Clone or download this repository.
2.  Open Chrome and go to `chrome://extensions/`.
3.  Enable **Developer mode** (top right corner).
4.  Click **Load unpacked** and select the extension folder.

### 2. Setup (First Time Only)
1.  Open the extension side panel (Click the extension icon).
2.  Go to the **Settings** tab (⚙️ icon).
3.  **Configure your preferences**:
    *   **Automation Tool**: Playwright / Selenium.
    *   **Language**: TypeScript, Java, etc.
    *   **LLM Provider**: Select Groq, OpenAI, or Testleaf.
    *   **API Key**: Enter your valid API key for the selected provider.
4.  **Select Outputs**:
    *   Choose between **Manual Test** or **Feature File**.
    *   Toggle **Page Object Model** and **Test Script** ON if you want code generation.
5.  Click **Save Settings**.

### 3. Generating Tests
1.  Navigate to the webpage you want to test.
2.  Open the extension side panel.
3.  Click the **🔍 Inspect** button.
4.  Hover over elements on the page (they will highlight). Click to capture them.
5.  (Optional) Add specific context or instructions in the "Additional Context" box (e.g., "Test negative login scenario").
6.  Click **✨ Generate**.

### 4. Review & Export
*   The AI will generate the requested outputs in separate tabs:
    *   **Test Case / Feature File**
    *   **Page Object Model**
    *   **Test Script**
*   Use the **📋 Copy** button to copy to clipboard.
*   Use the **📥 Download** button to save as a file.

---

## 🛠️ Supported Technologies

| Category | Supported Options |
| :--- | :--- |
| **Automation Tools** | Playwright, Selenium |
| **Languages** | TypeScript, Java, JavaScript, Python |
| **Test Types** | Manual, Gherkin (BDD), Functional Scripts |
| **AI Models** | Llama3 (via Groq), GPT-4o (via OpenAI), specialized models |

---

## 🔒 Privacy & Security

*   **Local Storage**: Your API keys and settings are stored locally in your browser (`chrome.storage.local`).
*   **Data Transmission**: The extension sends only the DOM structure of selected elements and your prompt to the chosen AI provider. No other browsing data is collected.

---

## 📂 Project Structure

*   `src/sidepanel/`: UI logic and Code Generation orchestrator.
*   `src/scripts/prompts/`: System prompts for different formats (Manual, Gherkin, POM, Script).
*   `src/scripts/api/`: API clients for Groq, OpenAI, and Testleaf.
*   `src/scripts/log.js`: Centralized logging utility.
*   `src/content_scripts/`: Logic for inspecting and highlighting DOM elements.

---

*Built with ❤️ for QA Engineers.*
