import GroqAPI from '../scripts/api/groq-api.js';
import OpenAIAPI from '../scripts/api/openai-api.js';
import TestleafAPI from '../scripts/api/testleaf-api.js';
import { getManualGherkinPrompt, getAutomationPrompt } from '../scripts/prompts.js';

export class CodeGenerator {
  constructor() {
    // Removed local debugMode in favor of centralized Logger.debug
    this.elements = {}; // Cache for frequently accessed DOM elements
    this.currentElements = []; // To store elements selected for code generation
    this.generationStats = { input: 0, output: 0, latency: 0 };
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
    this.elements['stats-display'] = document.getElementById('stats-display');

    // Output tab buttons
    this.elements['tab-test-case'] = document.getElementById('tab-test-case');
    this.elements['tab-pom'] = document.getElementById('tab-pom');
    this.elements['tab-script'] = document.getElementById('tab-script');

    // Output tab content panels
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

    // Tab labels
    this.elements['tc-tab-label'] = document.getElementById('tc-tab-label');
    this.elements['pom-tab-label'] = document.getElementById('pom-tab-label');
    this.elements['script-tab-label'] = document.getElementById('script-tab-label');

    // Tool info labels (inside content panels)
    this.elements['pom-tool-info'] = document.getElementById('pom-tool-info');
    this.elements['script-tool-info'] = document.getElementById('script-tool-info');

    // Progress indicator
    this.elements['progress-container'] = document.getElementById('progress-container');
    this.elements['progress-label'] = document.getElementById('progress-label');
    this.elements['progress-timer'] = document.getElementById('progress-timer');
    this.elements['progress-step'] = document.getElementById('progress-step');

    // API Error Modal
    this.elements['api-error-modal'] = document.getElementById('api-error-modal');
    this.elements['api-error-modal-message'] = document.getElementById('api-error-modal-message');
    this.elements['api-error-modal-ok-btn'] = document.getElementById('api-error-modal-ok-btn');
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

    // Output tab switching
    document.querySelectorAll('.output-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchOutputTab(tab.dataset.target));
    });

    // Dynamic copy/download listeners
    document.addEventListener('click', (e) => {
      if (e.target.closest('.copy-btn-dynamic')) {
        this.handleCopyClick(e.target.closest('.copy-btn-dynamic'));
      }
      if (e.target.closest('.download-btn-dynamic')) {
        this.handleDownloadClick(e.target.closest('.download-btn-dynamic'));
      }
    });

    if (this.elements['api-error-modal-ok-btn']) {
      this.elements['api-error-modal-ok-btn'].addEventListener('click', () => {
        if (this.elements['api-error-modal']) {
          this.elements['api-error-modal'].style.display = 'none';
        }
        if (this.elements['api-error-modal-message']) {
          this.elements['api-error-modal-message'].textContent = '';
        }
      });
    }
  }

  showApiError(message) {
    if (this.elements['api-error-modal'] && this.elements['api-error-modal-message']) {
      const currentMsg = this.elements['api-error-modal-message'].textContent;
      this.elements['api-error-modal-message'].textContent = currentMsg ? currentMsg + '\n\n' + message : message;
      this.elements['api-error-modal'].style.display = 'flex';
    } else {
      alert(message);
    }
  }

  /**
   * Switches the active output tab.
   */
  switchOutputTab(targetId) {
    // Deactivate all tabs
    document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));

    // Hide ALL content panels via inline style (bulletproof)
    document.querySelectorAll('.output-tab-content').forEach(c => {
      c.style.display = 'none';
    });

    // Activate clicked tab button and show its content panel
    const tabBtn = document.querySelector(`.output-tab[data-target="${targetId}"]`);
    const tabContent = document.getElementById(targetId);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.style.display = 'block';
  }

  /**
   * Shows only tabs that have content and activates the first one.
   */
  activateOutputTabs() {
    const visibleTabs = document.querySelectorAll('.output-tab[style*="display: flex"], .output-tab:not([style*="display: none"])');
    // More reliable: check which tab buttons are visible
    const tabs = ['tab-test-case', 'tab-pom', 'tab-script'];
    let firstVisibleTarget = null;

    for (const tabId of tabs) {
      const btn = this.elements[tabId];
      if (btn && btn.style.display !== 'none') {
        if (!firstVisibleTarget) {
          firstVisibleTarget = btn.dataset.target;
        }
      }
    }

    if (firstVisibleTarget) {
      this.switchOutputTab(firstVisibleTarget);
    }
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

  // --- Progress Indicator Methods ---

  startProgress() {
    this.progressStartTime = Date.now();
    this.elements['progress-container'].style.display = 'block';
    this.elements['progress-timer'].textContent = '0:00';
    this.elements['progress-label'].textContent = '⏳ Generating...';
    this.elements['progress-step'].textContent = 'Preparing...';

    this.progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.progressStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      this.elements['progress-timer'].textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  }

  updateProgressStep(step, total, message) {
    this.elements['progress-step'].textContent = `Step ${step} of ${total} · ${message}`;
  }

  stopProgress() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.elements['progress-container'].style.display = 'none';
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
      alert(chrome.i18n.getMessage("errorSelectElement") || "Please select at least one element to generate a test case.");
      return;
    }

    if (!navigator.onLine) {
      alert(chrome.i18n.getMessage("errorNoInternet") || "No Internet Connection. Please check your network settings.");
      return;
    }

    if (!settings.apiKey) {
      alert(chrome.i18n.getMessage("errorApiKeyMandatory") || "API Key is mandatory. Please provide a valid API Key in Settings.");
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

    // Start progress indicator
    this.startProgress();

    // Calculate total steps
    const hasManual = settings.outputFormat === 'manual' || settings.outputFormat === 'feature';
    const hasAutomation = settings.testPage === true || settings.testScript === true;
    const totalSteps = (hasManual ? 1 : 0) + (hasAutomation ? 1 : 0);
    let currentStep = 0;

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

    if (this.elements['api-error-modal-message']) {
      this.elements['api-error-modal-message'].textContent = '';
    }

    // Reset Stats
    this.generationStats = { input: 0, output: 0, latency: 0 };

    // 2. Set Dynamic Labels on Tab Buttons (clean names only)
    if (this.elements['tc-tab-label']) {
      this.elements['tc-tab-label'].textContent = settings.outputFormat === 'manual' ? 'Test Case' : 'Feature File';
    }
    if (this.elements['pom-tab-label']) {
      this.elements['pom-tab-label'].textContent = 'POM';
    }
    if (this.elements['script-tab-label']) {
      this.elements['script-tab-label'].textContent = 'Script';
    }

    // Set tool info inside content panels
    const toolInfoText = `${settings.automationTool} · ${settings.language}`;
    if (this.elements['pom-tool-info']) {
      this.elements['pom-tool-info'].textContent = toolInfoText;
    }
    if (this.elements['script-tool-info']) {
      this.elements['script-tool-info'].textContent = toolInfoText;
    }

    // Hide all tab buttons initially
    this.elements['tab-test-case'].style.display = 'none';
    this.elements['tab-pom'].style.display = 'none';
    this.elements['tab-script'].style.display = 'none';

    try {
      const context = this.elements['context-input'].value;
      await chrome.storage.local.set({ context });

      // --- PII Sanitization Check ---
      let elementsToProcess = JSON.parse(JSON.stringify(this.currentElements)); // Deep copy to avoid mutating original

      if (settings.sanitizePii === false) {
        // PII is NOT sanitized -> Warn User
        const userConfirmed = confirm(chrome.i18n.getMessage("piiWarningConfirm") || "PII has not been checked, which means we have a high possibility of sending sensitive info to AI.\n\nDo you want to continue?");

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

      // --- Filter Locators by Automation Tool ---
      // We only want to send the locator that matches the chosen tool to the LLM
      const selectedTool = (settings.automationTool || '').toLowerCase();
      elementsToProcess = elementsToProcess.map(el => {
        const filteredEl = { ...el };

        // Remove locators that do NOT match the selected tool
        if (selectedTool !== 'playwright') {
          delete filteredEl.playwrightLocator;
        }
        if (selectedTool !== 'selenium') {
          delete filteredEl.seleniumLocator;
        }

        return filteredEl;
      });
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
        currentStep++;
        this.updateProgressStep(currentStep, totalSteps, chrome.i18n.getMessage("progressStepBuilding") || 'Generating test cases...');
        this.log("Generating Manual/Gherkin...");
        const manualPrompt = getManualGherkinPrompt(promptPayload);
        this.log(`Sending Manual/Gherkin request to ${settings.llmProvider}...`);

        try {
          const startTime = Date.now();
          const response = await api.sendMessage(manualPrompt, settings.llmModel);
          const latency = Date.now() - startTime;

          const content = response.content || response;
          const usage = response.usage || null;
          Logger.log('[STATS] Manual call done. Usage:', usage, 'Latency:', latency);
          this.accumulateStats(usage, latency);
          this.parseAndDisplay(content, requirements, settings, 'test-case');
        } catch (e) {
          Logger.error("Manual/Gherkin Generation Failed:", e);
          const errorMsg = e.message || "Unknown error occurred";
          this.showApiError(`Manual/Gherkin Generation Failed:\n${errorMsg}`);
        }
      }

      // --- Call 2: Automation (POM / Script) ---
      if (requirements.pom || requirements.script) {
        currentStep++;
        this.updateProgressStep(currentStep, totalSteps, chrome.i18n.getMessage("progressStepAutomation") || 'Generating automation scripts...');
        this.log("Generating Automation Script...");
        const automationPrompt = getAutomationPrompt(promptPayload);
        this.log(`Sending Automation request to ${settings.llmProvider}...`);

        try {
          const startTime = Date.now();
          const response = await api.sendMessage(automationPrompt, settings.llmModel);
          const latency = Date.now() - startTime;

          const content = response.content || response;
          const usage = response.usage || null;
          Logger.log('[STATS] Automation call done. Usage:', usage, 'Latency:', latency);
          this.accumulateStats(usage, latency);
          this.parseAndDisplay(content, requirements, settings, 'script');
        } catch (e) {
          Logger.error("Automation Generation Failed:", e);
          const errorMsg = e.message || "Unknown error occurred";
          this.showApiError(`Automation Generation Failed:\n${errorMsg}`);
        }
      }

      // Activate first visible tab AFTER all content is parsed
      this.activateOutputTabs();

      if (this.elements['output-section']) {
        this.elements['output-section'].style.display = 'block';
      }

    } catch (error) {
      Logger.error("Error during generation:", error);
      alert(`Error: ${error.message}`);
    } finally {
      // Stop progress indicator
      this.stopProgress();

      // ALWAYS render stats - even if an error occurred during generation
      Logger.log('[STATS] Finally block reached. generationStats:', this.generationStats);
      this.renderStats();

      this.elements['inspect-btn'].disabled = btnStates.inspect;
      this.elements['stop-btn'].disabled = btnStates.stop;
      this.elements['reset-btn'].disabled = btnStates.reset;
      this.elements['generate-btn'].disabled = btnStates.generate;
    }
  }

  /**
   * Accumulates stats from each API call without rendering.
   */
  accumulateStats(usage, latency) {
    if (usage) {
      this.generationStats.input += (usage.input_tokens || 0);
      this.generationStats.output += (usage.output_tokens || 0);
    }
    if (latency) {
      this.generationStats.latency += latency;
    }
  }

  /**
   * Renders the accumulated stats into the DOM.
   * Uses direct document.getElementById to avoid any caching issues.
   */
  renderStats() {
    const el = document.getElementById('stats-display');
    Logger.log('[STATS] renderStats called. Element found:', !!el);
    if (!el) return;

    const { input, output, latency } = this.generationStats;
    Logger.log('[STATS] Rendering:', { input, output, latency });

    el.style.display = 'flex';
    el.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Input Tokens</span>
        <span class="stat-value">${input.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Output Tokens</span>
        <span class="stat-value">${output.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Latency</span>
        <span class="stat-value">${(latency / 1000).toFixed(2)}s</span>
      </div>
    `;
    Logger.log('[STATS] innerHTML set. Element display:', el.style.display, 'offsetHeight:', el.offsetHeight);
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
      this.elements['tab-test-case'].style.display = 'flex';
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
      this.elements['tab-pom'].style.display = 'flex';
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
      this.elements['tab-script'].style.display = 'flex';
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
        this.elements['tab-script'].style.display = 'flex';
        this.elements['area-script'].value = content;
        this.elements['preview-script'].innerHTML = this.renderMarkdown(content);
      } else {
        // Default to test case tab
        this.elements['tab-test-case'].style.display = 'flex';
        this.elements['area-test-case'].value = content;
        this.elements['preview-test-case'].innerHTML = this.renderMarkdown(content);
      }
    }

    // NOTE: activateOutputTabs is called from handleGenerateClick, not here

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
        attributes: this.sanitizeAttributes(el.attributes),
        playwrightLocator: el.playwrightLocator,
        seleniumLocator: el.seleniumLocator
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