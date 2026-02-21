# AI Test Case Generator (Chrome Extension)

🚀 **Generate Test Cases, Scripts & Page Objects Instantly from your Browser!**

The **AI Test Case Generator** is a powerful Chrome Extension designed to streamline the QA process. By simply inspecting elements on a webpage, you can use advanced AI (Groq, OpenAI, etc.) to automatically generate professional Test Cases, Gherkin Feature Files, Automation Scripts, and Page Object Models (POM).

## ✨ Key Features

*   **🔍 Interactive Element Inspection**: Point and click to select elements directly on any webpage.
*   **🎯 Native Semantic Locators**: Automatically generates highly resilient, custom locators (e.g., `getByRole`, `getByTestId` for Playwright, CSS/XPath for Selenium) during inspection to prevent LLM hallucination.
*   **🤖 Multi-LLM Support**: Choose your preferred AI provider:
    *   **Groq**: Fast and efficient.
    *   **OpenAI (GPT)**: Industry-leading reasoning.
*   **📝 Versatile Output Formats**:
    *   **Manual Test Cases**: Structured step-by-step instructions.
    *   **Gherkin / Cucumber**: Ready-to-use `.feature` files for BDD.
*   **💻 Automation Code Generation**:
    *   **Frameworks**: Playwright, Selenium.
    *   **Languages**: TypeScript, Java, JavaScript, Python.
    *   **Page Object Model (POM)**: Generates reusable page classes automatically.
*   **⚡ Parallel Generation**: Generate Test Cases and Automation Scripts simultaneously to save time.
*   **📊 Token Usage & Latency Stats**: Tracks input/output tokens and API latency across all generation calls.
*   **🎨 Theme Support**:
    *   **Light/Dark Mode**: Custom themes for comfortable viewing in any environment.
    *   **System Preference**: Automatically adapts to your OS settings.
*   **⏳ Real-time Progress**: Visual indicator with elapsed time and step tracking during generation.
*   **📂 Multi-Page Support**: Capture elements across different pages for complex workflows.
*   **🌐 Multi-Language Support (i18n)**: UI dynamically translates between English and French based on browser locale.

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
    *   **Theme**: Choose between System, Light, or Dark mode.
    *   **Automation Tool**: Playwright / Selenium.
    *   **Language**: TypeScript, Java, etc.
    *   **LLM Provider**: Select Groq, OpenAI, etc.
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
*   View **📊 Token Usage & Latency** stats at the top of the output section.

---

## 🛠️ Supported Technologies

| Category | Supported Options |
| :--- | :--- |
| **Automation Tools** | Playwright, Selenium |
| **Languages** | TypeScript, Java, JavaScript, Python |
| **Test Types** | Manual, Gherkin (BDD), Functional Scripts |
| **AI Models** | Llama3 (via Groq), GPT-4o (via OpenAI), Testleaf, specialized models |

---

## 🔒 Privacy & Security

### Privacy & Data Handling

This extension operates **entirely client-side**. No data is collected or stored by the extension developer.

*   **Your Data, Your Control**: DOM content and page information is sent **directly** to your configured LLM provider (Groq, OpenAI, etc.) using **your API key**.
*   **You Are the Data Controller**: You are responsible for ensuring compliance with your organization's data policies and applicable regulations (GDPR, etc.) when inspecting pages.
*   **No Centralized Collection**: The extension developer does not have access to your API keys, inspected pages, or generated test cases.

### PII Sanitization (Built-In Protection)

To help protect sensitive information, the extension includes **automatic PII redaction**:

*   **✅ Enabled by Default**: PII sanitization is ON by default in Settings.
*   **🧠 Smart Detection**: Uses NLP (Compromise.js) to detect and redact:
    *   Personal names → `[REDACTED_PERSON]`
    *   Email addresses → `[REDACTED_EMAIL]`
    *   Phone numbers → `[REDACTED_PHONE]`
*   **🔒 Pattern Masking**: Automatically masks:
    *   Password fields
    *   Credit card numbers
    *   IBAN/account numbers
*   **⚠️ User Responsibility**: You will be prompted with a warning if you disable PII sanitization.

### Best Practices

*   **Don't inspect production systems** with real customer data unless you have explicit consent to send that data to your LLM provider.
*   **Review your LLM provider's data policy** (Groq, OpenAI, etc.) to understand how they handle transmitted data.
*   **Keep PII Sanitization enabled** when working with potentially sensitive information.

### Local Storage

*   **API Keys**: Stored locally in your browser (`chrome.storage.local`) and encrypted by Chrome.
*   **Settings & Preferences**: Saved locally; never transmitted to third parties.

---

## 📂 Project Structure

*   `src/sidepanel/`: UI logic and Code Generation orchestrator.
*   `src/scripts/prompts/`: System prompts for different formats (Manual, Gherkin, POM, Script).
*   `src/scripts/api/`: API clients for Groq, OpenAI, etc.
*   `src/scripts/log.js`: Centralized logging utility.
*   `src/content_scripts/`: Logic for inspecting and highlighting DOM elements.

---

*Built with ❤️ for  AI enthusiasts / Business Analyst / QA Engineers.*
