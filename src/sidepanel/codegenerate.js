import GroqAPI from '../scripts/api/groq-api.js';
import OpenAIAPI from '../scripts/api/openai-api.js';
import TestleafAPI from '../scripts/api/testleaf-api.js';
import { getManualGherkinPrompt, getAutomationPrompt } from '../scripts/prompts.js';

export class CodeGenerator {
  constructor() {
    // Removed local debugMode in favor of centralized Logger.debug
    this.elements = {}; // Cache for frequently accessed DOM elements
    this.currentElements = []; // To store elements selected for code generation
    this.initialize();
  }

  log(message, ...args) {
    // Use the central Logger with a specific prefix for this component
    Logger.log(`[CodeGenerator] ${message}`, ...args);
  }

  cacheElements() {
    this.elements['generate-btn'] = document.getElementById('generate-btn');
    this.elements['context-input'] = document.getElementById('context-input');
    this.elements['output-section'] = document.querySelector('.output-section');
    this.elements['inspect-btn'] = document.getElementById('inspect-btn');
    this.elements['stop-btn'] = document.getElementById('stop-btn');
    this.elements['reset-btn'] = document.getElementById('reset-btn');

    // Output blocks
    this.elements['test-case-block'] = document.getElementById('test-case-output');
    this.elements['pom-block'] = document.getElementById('pom-output');
    this.elements['script-block'] = document.getElementById('script-output');

    // Output fields
    this.elements['area-test-case'] = document.getElementById('output-area-test-case');
    this.elements['preview-test-case'] = document.getElementById('output-preview-test-case');
    this.elements['area-pom'] = document.getElementById('output-area-pom');
    this.elements['preview-pom'] = document.getElementById('output-preview-pom');
    this.elements['area-script'] = document.getElementById('output-area-script');
    this.elements['preview-script'] = document.getElementById('output-preview-script');

    // Labels
    this.elements['tc-detail'] = document.getElementById('tc-label-detail');
    this.elements['pom-detail'] = document.getElementById('pom-label-detail');
    this.elements['script-detail'] = document.getElementById('script-label-detail');
  }

  async initialize() {
    this.log("Initializing CodeGenerator.");
    this.cacheElements();
    this.setupEventListeners();
    await this.loadInitialData();
  }

  setupEventListeners() {
    this.log("Setting up event listeners for generator.");
    this.elements['generate-btn'].addEventListener('click', this.handleGenerateClick.bind(this));

    // Dynamic copy/download listeners
    document.addEventListener('click', (e) => {
      if (e.target.closest('.copy-btn-dynamic')) {
        this.handleCopyClick(e.target.closest('.copy-btn-dynamic'));
      }
      if (e.target.closest('.download-btn-dynamic')) {
        this.handleDownloadClick(e.target.closest('.download-btn-dynamic'));
      }
    });
  }

  async loadInitialData() {
    const result = await chrome.storage.local.get(['selectedElements', 'context']);
    if (result.selectedElements) {
      this.currentElements = result.selectedElements;
      this.log("Loaded selected elements:", this.currentElements);
    }
    if (result.context && this.elements['context-input']) {
      this.elements['context-input'].value = result.context;
      this.log("Loaded context:", result.context);
    }
  }

  updateSelectedElements(elements) {
    this.currentElements = elements;
    this.log("CodeGenerator updated with new elements:", this.currentElements);
  }

  async handleGenerateClick() {
    this.log("Generate button clicked.");

    // Retrieve latest settings from storage
    const settings = await chrome.storage.local.get([
      'language',
      'automationTool',
      'llmProvider',
      'llmModel',
      'apiKey',
      'outputFormat',
      'testPage',
      'testPage',
      'testScript',
      'sanitizePii'
    ]);
    this.log("DEBUG: Retrieved settings from storage:", settings);

    if (this.currentElements.length === 0) {
      alert("Please select at least one element to generate a test case.");
      return;
    }

    if (!settings.apiKey) {
      alert("API Key is mandatory. Please provide a valid API Key in Settings.");
      return;
    }

    // Store current states
    const btnStates = {
      inspect: this.elements['inspect-btn'].disabled,
      stop: this.elements['stop-btn'].disabled,
      reset: this.elements['reset-btn'].disabled,
      generate: this.elements['generate-btn'].disabled
    };

    // Disable all buttons
    this.elements['inspect-btn'].disabled = true;
    this.elements['stop-btn'].disabled = true;
    this.elements['reset-btn'].disabled = true;
    this.elements['generate-btn'].disabled = true;

    // 1. Reset UI and Clear Old Content
    this.elements['test-case-block'].style.display = 'none';
    this.elements['pom-block'].style.display = 'none';
    this.elements['script-block'].style.display = 'none';
    this.elements['area-test-case'].value = '';
    this.elements['area-pom'].value = '';
    this.elements['area-script'].value = '';
    this.elements['preview-test-case'].innerHTML = '';
    this.elements['preview-pom'].innerHTML = '';
    this.elements['preview-script'].innerHTML = '';

    // 2. Set Dynamic Labels
    const toolInfo = `(${settings.automationTool} ${settings.language})`;
    this.elements['tc-detail'].textContent = `(${settings.outputFormat === 'manual' ? 'Manual' : 'Feature File'})`;
    this.elements['pom-detail'].textContent = toolInfo;
    this.elements['script-detail'].textContent = toolInfo;

    try {
      const context = this.elements['context-input'].value;
      await chrome.storage.local.set({ context });

      // --- PII Sanitization Check ---
      let elementsToProcess = JSON.parse(JSON.stringify(this.currentElements)); // Deep copy to avoid mutating original

      if (settings.sanitizePii === false) {
        // PII is NOT sanitized -> Warn User
        const userConfirmed = confirm("PII has not been checked, which means we have a high possibility of sending sensitive info to AI.\n\nDo you want to continue?");

        if (!userConfirmed) {
          this.log("Generation cancelled by user due to PII warning.");
          // Re-enable buttons before returning
          this.elements['inspect-btn'].disabled = btnStates.inspect;
          this.elements['stop-btn'].disabled = btnStates.stop;
          this.elements['reset-btn'].disabled = btnStates.reset;
          this.elements['generate-btn'].disabled = btnStates.generate;
          return;
        }
      } else {
        // PII shoud be sanitized -> Apply Sanitization Logic
        this.log("Sanitizing PII from selected elements...");
        elementsToProcess = this.sanitizeDOM(elementsToProcess);
      }
      // -----------------------------

      // 3. Requirements
      const requirements = {
        manual: settings.outputFormat === 'manual',
        feature: settings.outputFormat === 'feature',
        pom: settings.testPage === true,
        script: settings.testScript === true
      };

      this.log("Requirements:", requirements);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const promptPayload = {
        domContent: JSON.stringify(elementsToProcess, null, 2),
        userAction: context || "No specific action provided",
        pageUrl: tab?.url || "unknown",
        tool: settings.automationTool,
        lang: settings.language,
        requirements: requirements
      };

      // 4. Select API Provider
      let api;
      const apiKey = settings.apiKey;
      if (settings.llmProvider === 'groq') api = new GroqAPI(apiKey);
      else if (settings.llmProvider === 'openai') api = new OpenAIAPI(apiKey);
      else api = new TestleafAPI(apiKey);

      // --- Call 1: Manual / Gherkin ---
      if (requirements.manual || requirements.feature) {
        this.log("Generating Manual/Gherkin...");
        const manualPrompt = getManualGherkinPrompt(promptPayload);
        this.log(`Sending Manual/Gherkin request to ${settings.llmProvider}...`);

        try {
          const response = await api.sendMessage(manualPrompt, settings.llmModel);
          const content = response.content || response;
          this.parseAndDisplay(content, requirements, settings, 'test-case');
        } catch (e) {
          Logger.error("Manual/Gherkin Generation Failed:", e);
          this.elements['area-test-case'].value = `Error generating test case: ${e.message}`;
          this.elements['test-case-block'].style.display = 'block';
        }
      }

      // --- Call 2: Automation (POM / Script) ---
      if (requirements.pom || requirements.script) {
        this.log("Generating Automation Script...");
        const automationPrompt = getAutomationPrompt(promptPayload);
        this.log(`Sending Automation request to ${settings.llmProvider}...`);

        try {
          const response = await api.sendMessage(automationPrompt, settings.llmModel);
          const content = response.content || response;
          this.parseAndDisplay(content, requirements, settings, 'script');
        } catch (e) {
          Logger.error("Automation Generation Failed:", e);
          // Fallback error display in script block
          this.elements['area-script'].value = `Error generating script: ${e.message}`;
          this.elements['script-block'].style.display = 'block';
        }
      }

      if (this.elements['output-section']) {
        this.elements['output-section'].style.display = 'block';
      }

    } catch (error) {
      Logger.error("Error during generation:", error);
      alert(`Error: ${error.message}`);
    } finally {
      this.elements['inspect-btn'].disabled = btnStates.inspect;
      this.elements['stop-btn'].disabled = btnStates.stop;
      this.elements['reset-btn'].disabled = btnStates.reset;
      this.elements['generate-btn'].disabled = btnStates.generate;
    }
  }

  parseAndDisplay(content, requirements, settings, fallbackTarget = 'test-case') {
    this.log("Parsing combined response...");
    this.log("Full response length:", content.length);

    // Log what tags we're looking for
    this.log("Requirements:", requirements);

    // DEBUG: Show first 500 chars of raw response
    // Use this.log to ensure it respects debug mode, or direct Logger if preferred
    this.log("=== RAW LLM RESPONSE (first 500 chars) ===");
    this.log(content.substring(0, 500));
    this.log("=== END RAW RESPONSE PREVIEW ===");

    // Robust string-based extraction helper
    const extractContent = (tagBase) => {
      const startTags = [`[[START_${tagBase}]]`, `[START_${tagBase}]`, `[[${tagBase}]]`];
      const endTags = [`[[END_${tagBase}]]`, `[END_${tagBase}]`, `[[/${tagBase}]]`];

      for (let i = 0; i < startTags.length; i++) {
        const startIdx = content.indexOf(startTags[i]);
        if (startIdx !== -1) {
          this.log(`Found ${tagBase} start tag: ${startTags[i]} at position ${startIdx}`);
          const contentStart = startIdx + startTags[i].length;
          const endIdx = content.indexOf(endTags[i], contentStart);
          if (endIdx !== -1) {
            this.log(`Found ${tagBase} end tag at position ${endIdx}`);
            const extracted = content.substring(contentStart, endIdx).trim();
            this.log(`Extracted ${tagBase} content (${extracted.length} chars)`);
            return extracted;
          }
          // If no end tag found but start tag exists, take until next START tag or end
          const nextStartIdx = content.indexOf('[[START_', contentStart);
          if (nextStartIdx !== -1) {
            this.log(`No end tag for ${tagBase}, taking until next START tag at ${nextStartIdx}`);
            return content.substring(contentStart, nextStartIdx).trim();
          }
          this.log(`No end tag for ${tagBase}, taking everything remaining`);
          return content.substring(contentStart).trim();
        }
      }
      this.log(`No tags found for ${tagBase}`);
      return null;
    };

    const langHint = settings.language ? settings.language.toLowerCase() : '';

    // 1. Test Case
    this.log("=== Extracting Test Case ===");
    let tcContent = extractContent("MANUAL_TEST") || extractContent("FEATURE_FILE");
    if (tcContent) {
      this.log("Found Test Case content, first 100 chars:", tcContent.substring(0, 100));
      this.elements['test-case-block'].style.display = 'block';
      this.elements['area-test-case'].value = tcContent;
      // If it's a feature file and doesn't have backticks, wrap it
      if (requirements.feature && !tcContent.includes('```')) {
        tcContent = `\`\`\`gherkin\n${tcContent}\n\`\`\``;
      }
      this.elements['preview-test-case'].innerHTML = this.renderMarkdown(tcContent);
    }

    // 2. Page Object Model
    this.log("=== Extracting POM ===");
    const pomContent = extractContent("POM");
    if (pomContent) {
      this.log("Found POM content, first 100 chars:", pomContent.substring(0, 100));
      this.elements['pom-block'].style.display = 'block';
      this.elements['area-pom'].value = pomContent;
      let displayContent = pomContent;
      if (!displayContent.includes('```')) {
        displayContent = `\`\`\`${langHint}\n${displayContent}\n\`\`\``;
      }
      this.elements['preview-pom'].innerHTML = this.renderMarkdown(displayContent);
    }

    // 3. Test Script
    this.log("=== Extracting Test Script ===");
    const scriptContent = extractContent("TEST_SCRIPT");
    if (scriptContent) {
      this.log("Found Test Script content, first 100 chars:", scriptContent.substring(0, 100));
      this.elements['script-block'].style.display = 'block';
      this.elements['area-script'].value = scriptContent;
      let displayContent = scriptContent;
      if (!displayContent.includes('```')) {
        displayContent = `\`\`\`${langHint}\n${displayContent}\n\`\`\``;
      }
      this.elements['preview-script'].innerHTML = this.renderMarkdown(displayContent);
    }

    // Fallback: If absolutely NOTHING was extracted, dump the raw response to specified target
    if (!tcContent && !pomContent && !scriptContent) {
      this.log(`Parser failed to find any tags. Performing fallback dump to ${fallbackTarget}.`);

      if (fallbackTarget === 'script') {
        this.elements['script-block'].style.display = 'block';
        this.elements['area-script'].value = content;
        this.elements['preview-script'].innerHTML = this.renderMarkdown(content);
      } else {
        // Default to test case block
        this.elements['test-case-block'].style.display = 'block';
        this.elements['area-test-case'].value = content;
        this.elements['preview-test-case'].innerHTML = this.renderMarkdown(content);
      }
    }

    // Ensure syntax highlighting is applied to all new code blocks
    setTimeout(() => {
      if (window.Prism) {
        document.querySelectorAll('.markdown-body pre code').forEach(block => {
          window.Prism.highlightElement(block);
        });
      }
    }, 100);
  }

  renderMarkdown(text) {
    if (!window.marked) return `<pre>${text}</pre>`;
    return window.marked.parse(text);
  }

  handleCopyClick(btn) {
    const targetId = btn.dataset.target;
    const textarea = document.getElementById(targetId);
    if (textarea) {
      textarea.select();
      document.execCommand('copy');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
  }

  handleDownloadClick(btn) {
    const targetId = btn.dataset.target;
    const filename = btn.dataset.filename;
    const textarea = document.getElementById(targetId);
    if (textarea && textarea.value) {
      const blob = new Blob([textarea.value], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * sanitizeDOM
   * masks sensitive values and patterns in the captured HTML content.
   */
  sanitizeDOM(elements) {
    return elements.map(el => {
      let sanitizedHtml = el.html || "";

      // 1. Attribute Masking (Regex)
      // Mask 'value' for password inputs
      sanitizedHtml = sanitizedHtml.replace(/(<input[^>]*type=["']password["'][^>]*value=["'])([^"']*)(["'])/gi, '$1[REDACTED_PASSWORD]$3');

      // Mask 'value' for sensitive keywords in ID/Name/Class/Autocomplete
      const sensitiveKeywords = "password|secret|token|key|ssn|credit-card|card-number|cvc|cvv|account-number";
      const sensitivePattern = new RegExp(`((id|name|class|autocomplete)=["'][^"']*(${sensitiveKeywords})[^"']*["'][^>]*value=["'])([^"']*)(["'])`, 'gi');

      sanitizedHtml = sanitizedHtml.replace(sensitivePattern, '$1[REDACTED_SENSITIVE]$5');

      // 2. Text Content Redaction (Compromise NLP + Regex Fallback)
      // We use a temporary DOM element to safely traverse text nodes without braking HTML structure
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitizedHtml;

      this.sanitizeTextNodes(tempDiv);

      sanitizedHtml = tempDiv.innerHTML;

      // 3. Regex Fallback for strict patterns (Credit Cards, IBANs) which NLP might miss
      const ccPattern = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
      sanitizedHtml = sanitizedHtml.replace(ccPattern, '[REDACTED_CC]');

      const ibanPattern = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
      sanitizedHtml = sanitizedHtml.replace(ibanPattern, '[REDACTED_IBAN]');

      return {
        ...el,
        html: sanitizedHtml,
        attributes: this.sanitizeAttributes(el.attributes)
      };
    });
  }

  sanitizeTextNodes(node) {
    if (node.nodeType === 3) { // Node.TEXT_NODE
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) return;

      let text = node.textContent;
      if (!text || !text.trim()) return;

      // NLP Redaction
      if (window.nlp) {
        try {
          const doc = window.nlp(text);
          let modified = false;

          // Redact People
          if (doc.people().found) { doc.people().replaceWith('[REDACTED_PERSON]'); modified = true; }

          // Redact Emails
          if (doc.emails().found) { doc.emails().replaceWith('[REDACTED_EMAIL]'); modified = true; }

          // Redact Phone Numbers
          if (doc.phoneNumbers().found) { doc.phoneNumbers().replaceWith('[REDACTED_PHONE]'); modified = true; }

          if (modified) {
            text = doc.text();
          }
        } catch (e) {
          // Fallback if NLP fails
          console.warn("NLP Sanitization failed for text node:", e);
        }
      }

      // Regex Fallback for Email/Phone if NLP missed or is absent
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      text = text.replace(emailPattern, '[REDACTED_EMAIL]');

      // Simple Phone Regex (fallback)
      const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      text = text.replace(phonePattern, '[REDACTED_PHONE]');

      node.textContent = text;
    } else {
      node.childNodes.forEach(child => this.sanitizeTextNodes(child));
    }
  }

  sanitizeAttributes(attributes) {
    if (!attributes) return {};
    const sanitized = { ...attributes };
    const sensitiveKeys = ['value', 'data-value'];
    const sensitiveKeywords = ['password', 'secret', 'token', 'key', 'ssn', 'cvc', 'cvv'];

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      // Check if attribute name is suspicious
      if (sensitiveKeywords.some(k => lowerKey.includes(k))) {
        sanitized[key] = '[REDACTED_ATTR_NAME]';
      }
      // Check if specific keys have sensitive values
      if (sensitiveKeys.includes(lowerKey)) {
        // Perform check if value looks sensitive? For now, if we are sanitizing attributes object, 
        // we might just want to be safe if the key *or* context implies sensitivity.
        // But the `html` string replacement is the primary defense for the LLM prompt.
        // Let's rely on the regexes above for the bulk.
        // Implementing specific attribute masking here as a fallback
        if (sanitized['type'] === 'password') {
          sanitized[key] = '[REDACTED_PASSWORD]';
        }
      }
    }
    return sanitized;
  }
}