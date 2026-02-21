# Development Guide

This guide covers the local setup, development workflow, and debugging techniques for the AI Test Case Generator extension.

## Prerequisites

-   **Google Chrome** or a Chromium-based browser (Edge, Brave).
-   **Node.js & npm** (optional, mostly for managing external libraries if needed in the future).
-   **Visual Studio Code** (recommended).

## Installation

1.  Clone the repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the root directory of this project (`AITestGen-develop-ini`).

## Project Structure

```
root/
├── _locales/            # i18n language files (en, fr)
├── src/
│   ├── background/      # Service worker (background processes)
│   ├── content_scripts/ # Scripts injected into web pages (DOM inspection)
│   ├── sidepanel/       # The main UI of the extension
│   ├── scripts/         # Shared logic (API, Prompts, Logging)
│   └── data/            # Static data files
├── lib/                 # Third-party libraries (Prism, Marked, Compromise)
├── icons/               # Extension icons
├── docs/                # Documentation
└── manifest.json        # Extension configuration
```

> [!IMPORTANT]
> **Script Loading Order in `sidepanel.html`:**
> `log.js` must be loaded as a regular `<script>` **before** any `<script type="module">` tags. ES modules are deferred, so `Logger` must be globally available before `codegenerate.js` and `sidepanel.js` execute.

## detailed Component Overview

### Side Panel (`src/sidepanel/`)
-   **Entry Point:** `sidepanel.html`
-   **Logic:** `sidepanel.js` (UI interaction) and `codegenerate.js` (AI orchestration).
-   **Settings:** `settings.js` manages user preferences stored in `chrome.storage.local`.

### Content Scripts (`src/content_scripts/`)
-   `content.js`: Handles element highlighting, inspection, capturing DOM data, and computing resilient `playwrightLocator`/`seleniumLocator` strings.
-   Communicates with the Side Panel via `chrome.runtime.sendMessage`.

### Background Script (`src/background/`)
-   `background.js`: Handles extension life-cycle events and context menu interactions (if any).

## Debugging

### Debugging the Side Panel
1.  Open the extension side panel.
2.  Right-click anywhere in the side panel and select **Inspect**.
3.  This opens a dedicated DevTools window for the side panel. You can see `console.log` outputs here.

### Debugging Content Scripts
1.  Open the webpage you are inspecting.
2.  Open the regular DevTools (F12).
3.  Look at the **Console** tab. Messages from `content.js` will appear here.

### Debugging the Background Script
1.  Go to `chrome://extensions/`.
2.  Find the extension card.
3.  Click the link that says **service worker**.
4.  A new DevTools window will open for the background process.

## Testing

Since this is a browser extension, testing is primarily manual:

1.  **Load the extension.**
2.  **Open a target website** (e.g., a login page).
3.  **Inspect elements** using the extension.
4.  **Generate** test cases and scripts.
5.  **Verify** the output correctness.

**Tip:** Use the `Reload` button on the extension card in `chrome://extensions/` after making changes to the code. You may also need to refresh the web page you are inspecting to reload the content scripts.
