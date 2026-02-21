Project File Usage Analysis
Date: 2026-02-21
Extension: AI Test Case Generator v1.1.0

# ACTIVE / IN-USE FILES
-----------------------
These files are referenced in manifest.json or imported by active scripts.

1. Core Extension Files
   - manifest.json (Main extension configuration, sets default locale)
   - _locales/en/messages.json (English localization dictionary)
   - _locales/fr/messages.json (French localization dictionary)
   - src/background/background.js (Service worker)
   - src/content_scripts/content.js (DOM inspection, element selection, & advanced semantic locator extraction using Shadow DOM penetration, resilience scoring, fallback chains, semantic parents, and relative positioning)
   - src/content_scripts/inspect.css (Inspector UI styling)
   - src/scripts/log.js (Centralized logging utility)

2. Side Panel UI
   - src/sidepanel/sidepanel.html (Main UI entry point)
   - src/sidepanel/sidepanel.css (Side panel styling incl. stats display, sticky tabs)
   - src/sidepanel/sidepanel.js (UI controller, navigation, & i18n initialization)
   - src/sidepanel/codegenerate.js (Code generation logic, API Error modal, & stats tracking)
   - src/sidepanel/settings.js (Settings management)

3. Prompt System
   - src/scripts/prompts.js (Main prompt builder & orchestrator)
   - src/scripts/prompts/selenium.js (Selenium-specific prompts)
   - src/scripts/prompts/playwright.js (Playwright-specific prompts)
   - src/scripts/prompts/gherkin.js (Gherkin/Cucumber prompts)
   - src/scripts/prompts/manual.js (Manual test case prompts)

4. API Integrations
   - src/scripts/api/api-utils.js (Shared Utility for exponential backoff retries and timeouts)
   - src/scripts/api/groq-api.js (Groq API client, returns usage stats, streams)
   - src/scripts/api/openai-api.js (OpenAI API client, returns usage stats, streams)
   - src/scripts/api/testleaf-api.js (Testleaf API client, returns usage stats)

5. External Libraries
   - lib/compromise/compromise.min.js (NLP library for PII detection/sanitization)
   - lib/marked/marked.min.js (Markdown parsing, used in sidepanel.html)
   - lib/prism/prism.js (Syntax highlighting core)
   - lib/prism/prism-typescript.js (TypeScript syntax support)
   - lib/prism/prism-gherkin.js (Gherkin syntax support)
   - lib/prism/prism-okaidia.css (Prism dark theme)

6. Data & Assets
   - src/data/dropdown-data.json (UI dropdown configurations)
   - icons/icon16.png (Extension icon 16x16)
   - icons/icon48.png (Extension icon 48x48)
   - icons/icon128.png (Extension icon 128x128)

7. Documentation
   - README.md (Project overview & usage guide)
   - docs/API_INTEGRATION.md (Guide for adding new LLM providers)
   - docs/COMPLIANCE_AUDIT.md (GDPR/EU AI Act/DORA compliance audit)
   - docs/DEVELOPMENT.md (Local development & debugging guide)
   - docs/PROMPTS.md (Prompt engineering guide for ICE-TOP framework)

# ARCHITECTURE OVERVIEW
-----------------------
The extension uses a Chrome Side Panel architecture with:
- Background service worker for extension lifecycle management
- Content scripts for DOM inspection and element highlighting
- Side panel UI for test generation and settings
- Multi-provider LLM API support (Groq, OpenAI, Testleaf)
- Modular prompt system using ICE-TOP framework
- Parallel generation for Manual Test Cases and Automation Scripts
- Token usage & latency stats tracking across API calls
- PII sanitization via NLP (Compromise.js) and regex patterns

# SCRIPT LOADING ORDER (sidepanel.html)
-----------------------------------------
1. lib/compromise/compromise.min.js (NLP, regular script)
2. src/scripts/log.js (Logger, regular script — must load before modules)
3. src/sidepanel/codegenerate.js (ES module)
4. src/sidepanel/sidepanel.js (ES module, imports CodeGenerator)
5. src/sidepanel/settings.js (regular script)

# LOGGING
----------
✅ Centralized Logging Implemented:
   - All components use `src/scripts/log.js`.
   - `Logger.debug` flag controls verbosity globally.
   - Logger must be loaded as a regular script BEFORE ES modules.

# NOTES
-------
- All APIs use ES6 modules (import/export)
- API classes return { content, usage } objects for stats tracking
- Unified logging via `src/scripts/log.js`; debug mode controlled by `Logger.debug`
- The extension supports Selenium, Playwright, and Cucumber/Gherkin
- Multi-language support: Java, TypeScript, JavaScript, Python
- PII sanitization uses Compromise.js NLP + regex fallbacks
