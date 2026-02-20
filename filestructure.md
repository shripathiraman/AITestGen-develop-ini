AITestGen-develop-ini/
├── .gitignore
├── .vscode/
│   └── settings.json
├── _locales/
│   ├── en/
│   │   └── messages.json
│   └── fr/
│       └── messages.json
├── docs/
│   ├── API_INTEGRATION.md
│   ├── COMPLIANCE_AUDIT.md
│   ├── DEVELOPMENT.md
│   └── PROMPTS.md
├── icons/
│   ├── icon128.png
│   ├── icon16.png
│   └── icon48.png
├── lib/
│   ├── compromise/
│   │   └── compromise.min.js
│   ├── marked/
│   │   └── marked.min.js
│   └── prism/
│       ├── prism-gherkin.js
│       ├── prism-okaidia.css
│       ├── prism-typescript.js
│       └── prism.js
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content_scripts/
│   │   ├── content.js
│   │   └── inspect.css
│   ├── data/
│   │   └── dropdown-data.json
│   ├── scripts/
│   │   ├── api/
│   │   │   ├── groq-api.js
│   │   │   ├── openai-api.js
│   │   │   └── testleaf-api.js
│   │   ├── prompts/
│   │   │   ├── gherkin.js
│   │   │   ├── manual.js
│   │   │   ├── playwright.js
│   │   │   └── selenium.js
│   │   ├── log.js
│   │   └── prompts.js
│   └── sidepanel/
│       ├── codegenerate.js
│       ├── settings.js
│       ├── sidepanel.css
│       ├── sidepanel.html
│       └── sidepanel.js
├── README.md
├── fileinfo.md
├── filestructure.md
└── manifest.json

DIRECTORY SUMMARY:
------------------
Total Directories: 15
Total Files: 32

KEY ENTRY POINTS:
-----------------
- manifest.json → Extension configuration
- src/sidepanel/sidepanel.html → Main UI
- src/background/background.js → Service worker
- src/content_scripts/content.js → DOM inspector
- src/scripts/prompts.js → Prompt orchestrator
- src/sidepanel/codegenerate.js → Test generation logic & stats tracking
- src/scripts/log.js → Centralized logging utility
