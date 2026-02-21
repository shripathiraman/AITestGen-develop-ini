class SettingsManager {
  constructor() {
    this.dropdownData = {};
    this.elements = {}; // Cache for frequently accessed DOM elements
    this.initialize();
  }

  log(message, ...args) {
    // Directly use Logger as it is globally available
    Logger.log(`[SettingsManager] ${message}`, ...args);
  }

  async initialize() {
    this.log("Initializing SettingsManager.");
    this.cacheElements();
    await this.fetchDropdownData();
    this.setupEventListeners();
    this.loadSettings();
  }

  cacheElements() {
    const ids = [
      'save-settings', 'automation-tool', 'llm-provider',
      'api-key', 'language', 'llm-model',
      'multi-page', 'test-page', 'test-script',
      'api-key-error', 'sanitize-pii'
    ];
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    // Cache dual-option elements separately as they are a collection
    this.elements.dualOptions = document.querySelectorAll('.dual-option');
    this.elements.switchInputs = document.querySelectorAll('.switch input');
    this.elements.themeOptions = document.querySelectorAll('.theme-option');
  }

  async fetchDropdownData() {
    try {
      // Use chrome.runtime.getURL to access bundled resources in a Chrome Extension
      const response = await fetch(chrome.runtime.getURL('src/data/dropdown-data.json'));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.dropdownData = await response.json();
      this.log("Dropdown data loaded:", this.dropdownData);
    } catch (error) {
      Logger.error("[SettingsManager] Error fetching dropdown data. Please ensure 'src/data/dropdown-data.json' exists and is declared in 'web_accessible_resources' in manifest.json:", error);
      // Fallback or error handling for UI if data fails to load
    }
  }

  setupEventListeners() {
    this.log("Setting up event listeners.");
    this.elements['save-settings'].addEventListener('click', () => this.saveSettings());
    this.elements['automation-tool'].addEventListener('change', () => this.populateProgrammingLanguages());
    this.elements['llm-provider'].addEventListener('change', () => this.populateLlmModels());

    this.elements.dualOptions.forEach(option => {
      option.addEventListener('click', (event) => {
        this.log("Dual toggle option clicked:", event.target.dataset.value);
        this.handleDualToggle(event.target);
      });
    });

    this.elements.switchInputs.forEach(switchInput => {
      switchInput.addEventListener('change', () => {
        this.log(`Switch toggled: ${switchInput.id}, checked: ${switchInput.checked}`);
      });
    });

    // Add immediate feedback for API key input
    this.elements['api-key'].addEventListener('input', this.handleApiKeyInputValidation.bind(this));

    // Theme toggle — apply immediately on click
    this.elements.themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.elements.themeOptions.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        this.applyTheme(option.dataset.value);
        chrome.storage.local.set({ theme: option.dataset.value });
      });
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.log(`Theme applied: ${theme}`);
  }

  populateDropdown(dropdownElement, items, defaultValue = null) {
    if (!dropdownElement) {
      this.log(`Dropdown element not provided. Cannot populate.`);
      return;
    }
    dropdownElement.innerHTML = ''; // Clear existing options

    if (!items || items.length === 0) {
      this.log(`No items provided for dropdown '${dropdownElement.id}'.`);
      const noOption = document.createElement('option');
      noOption.value = '';
      noOption.textContent = 'No options available';
      noOption.disabled = true;
      dropdownElement.appendChild(noOption);
      return;
    }

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.description;
      dropdownElement.appendChild(option);
    });

    // Set default value if available and exists in options
    if (defaultValue && [...dropdownElement.options].some(option => option.value === defaultValue)) {
      dropdownElement.value = defaultValue;
    } else if (dropdownElement.options.length > 0) {
      // If no specific default or provided default not found, set to the first option
      dropdownElement.value = dropdownElement.options[0].value;
      this.log(`Default for '${dropdownElement.id}' set to first available option: ${dropdownElement.options[0].value}`);
    }
    this.log(`Dropdown '${dropdownElement.id}' populated. Current value: ${dropdownElement.value}`);
  }

  populateAutomationTools(selectedValue) {
    this.log("Populating automation tools.");
    // Default to 'playwright' if no selectedValue is provided
    this.populateDropdown(this.elements['automation-tool'], this.dropdownData.automationTools, selectedValue || 'playwright');
    this.populateProgrammingLanguages(); // Populate languages based on the (now set) automation tool
  }

  populateProgrammingLanguages(selectedValue) {
    const selectedTool = this.elements['automation-tool']?.value;
    this.log(`Populating programming languages for tool: ${selectedTool}`);
    const languages = this.dropdownData.programmingLanguages?.[selectedTool] || [];
    // Default to 'typescript' if no selectedValue is provided
    this.populateDropdown(this.elements['language'], languages, selectedValue || 'typescript');
  }

  populateLlmProviders(selectedValue) {
    this.log("Populating LLM providers.");
    // Default to 'groq' if no selectedValue is provided
    this.populateDropdown(this.elements['llm-provider'], this.dropdownData.llmProviders, selectedValue || 'groq');
    this.populateLlmModels(); // Populate models based on the (now set) LLM provider
  }

  populateLlmModels(selectedValue) {
    const selectedProvider = this.elements['llm-provider']?.value;
    this.log(`Populating LLM models for provider: ${selectedProvider}`);
    const models = this.dropdownData.llmModels?.[selectedProvider] || [];
    // Default to 'deepseek' if no selectedValue is provided
    this.populateDropdown(this.elements['llm-model'], models, selectedValue || 'llama-3.3-70b-versatile');
  }

  handleDualToggle(clickedOption) {
    this.elements.dualOptions.forEach(option => {
      option.classList.remove('active');
    });
    clickedOption.classList.add('active');
  }

  async loadSettings() {
    this.log("Loading settings from storage...");
    const defaultSettings = {
      language: 'typescript',
      automationTool: 'playwright',
      llmProvider: 'groq',
      llmModel: 'llama-3.3-70b-versatile',
      apiKey: '',
      outputFormat: 'manual',
      multiPage: true,
      featureTest: false, // This was in the storage keys but not used in UI, maintaining for consistency
      testPage: false,
      testScript: false,
      sanitizePii: true,
      theme: 'system'
    };

    const settings = await chrome.storage.local.get(defaultSettings);
    this.log("Settings loaded:", settings);

    // Populate dropdowns with loaded settings or defaults
    this.populateAutomationTools(settings.automationTool);
    // populateProgrammingLanguages is called by populateAutomationTools
    this.populateLlmProviders(settings.llmProvider);
    // populateLlmModels is called by populateLlmProviders

    // After initial population, explicitly set value for dependent dropdowns
    // if a specific value was loaded from storage, ensuring it overrides the default.
    // This handles cases where the default from storage might not be the first option in the dynamically loaded list.
    this.setDropdownValue(this.elements['language'], settings.language, 'language');
    this.setDropdownValue(this.elements['llm-model'], settings.llmModel, 'LLM model');

    if (this.elements['api-key']) {
      this.elements['api-key'].value = settings.apiKey;
    }

    // Set output format (dual toggle)
    this.elements.dualOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.value === settings.outputFormat) {
        option.classList.add('active');
      }
    });

    // Set switch toggles
    this.elements['multi-page'].checked = settings.multiPage;
    this.elements['test-page'].checked = settings.testPage;
    this.elements['test-script'].checked = settings.testScript;
    this.elements['sanitize-pii'].checked = settings.sanitizePii;

    // Set theme toggle
    this.applyTheme(settings.theme || 'system');
    this.elements.themeOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.value === (settings.theme || 'system')) {
        option.classList.add('active');
      }
    });

    this.log("Settings loaded and applied to UI.");
  }

  setDropdownValue(dropdownElement, value, label) {
    if (dropdownElement && value) {
      if ([...dropdownElement.options].some(option => option.value === value)) {
        dropdownElement.value = value;
      } else {
        this.log(`Loaded ${label} '${value}' not found in options for selected category. Sticking with default.`);
      }
    }
  }

  handleApiKeyInputValidation() {
    const apiKeyInput = this.elements['api-key'];
    const errorMessageElement = this.elements['api-key-error'];

    if (apiKeyInput.value.trim() !== '') {
      apiKeyInput.classList.remove('error-border');
      if (errorMessageElement) {
        errorMessageElement.remove();
        this.elements['api-key-error'] = null; // Clear cached reference if element is removed
      }
    }
  }

  showApiKeyError() {
    const apiKeyInput = this.elements['api-key'];
    apiKeyInput.classList.add('error-border');

    let errorMessage = this.elements['api-key-error'];
    if (!errorMessage) {
      errorMessage = document.createElement('div');
      errorMessage.id = 'api-key-error';
      errorMessage.classList.add('error-message');
      apiKeyInput.parentNode.insertBefore(errorMessage, apiKeyInput.nextSibling);
      this.elements['api-key-error'] = errorMessage; // Cache the new element
    }
    errorMessage.textContent = chrome.i18n.getMessage("errorApiKeyMandatory") || 'API Key is mandatory. Please provide a valid API Key.';
    apiKeyInput.focus();
  }

  async saveSettings() {
    this.log("Saving settings...");

    const apiKey = this.elements['api-key'].value.trim();

    if (!apiKey) {
      this.log("API key is missing, showing error.");
      this.showApiKeyError();
      return;
    } else {
      this.handleApiKeyInputValidation(); // Clear any existing error
    }

    const settings = {
      automationTool: this.elements['automation-tool'].value,
      language: this.elements['language'].value,
      llmProvider: this.elements['llm-provider'].value,
      llmModel: this.elements['llm-model'].value,
      apiKey: apiKey,
      outputFormat: document.querySelector('.dual-option.active').dataset.value, // Still need to query as it's not cached in elements specifically
      multiPage: this.elements['multi-page'].checked,
      testPage: this.elements['test-page'].checked,
      testScript: this.elements['test-script'].checked,
      sanitizePii: this.elements['sanitize-pii'].checked,
      theme: document.querySelector('.theme-option.active')?.dataset.value || 'system'
    };

    await chrome.storage.local.set(settings);
    this.log("Settings saved successfully:", settings);
    this.showSaveConfirmation();
  }

  showSaveConfirmation() {
    const saveBtn = this.elements['save-settings'];
    const originalText = saveBtn.textContent;
    const originalBg = saveBtn.style.backgroundColor;

    saveBtn.textContent = chrome.i18n.getMessage("textSaved") || 'Settings Saved!';
    saveBtn.style.backgroundColor = 'var(--color-success)';

    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = originalBg;
    }, 2000);
  }
}

// Initialize the SettingsManager when the DOM is fully loaded for the settings tab.
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('settings')) {
    new SettingsManager();
  }
});

// Apply saved theme immediately (before DOMContentLoaded) to prevent FOUC
(function () {
  chrome.storage.local.get({ theme: 'system' }, (result) => {
    document.documentElement.setAttribute('data-theme', result.theme || 'system');
  });
})();