# Prompt Engineering Guide

This extension uses a structured approach to prompt engineering called **ICE-TOP** to ensure consistent and high-quality outputs from LLMs.

## The ICE-TOP Framework

Every prompt is constructed using these six components:

1.  **I - Instruction:** clear, direct command of what the AI should do. (e.g. Strict directives forcing the AI to strictly use only our pre-computed `playwrightLocator`/`seleniumLocator` fields).
2.  **C - Context:** Relevant background information (DOM structure, Page URL, User Intent).
3.  **E - Example:** One-shot or few-shot examples of the input and expected output.
4.  **T - Tone:** The desired style of the response (e.g., "Professional", "Strict").
5.  **O - Output:** The exact format required (e.g., "Markdown code block only", "No explanations").
6.  **P - Persona:** The role the AI should adopt (e.g., "Expert QA Automation Engineer").

## Prompt File Structure

Prompts are located in `src/scripts/prompts/`:

-   `prompts.js`: Main entry point. Exports functions to generate full prompt strings.
-   `playwright.js`: Prompts specific to Playwright (TypeScript/JavaScript).
-   `selenium.js`: Prompts specific to Selenium (Java/Python).
-   `gherkin.js`: Prompts for BDD Feature file generation.
-   `manual.js`: Prompts for Manual Test Case generation.

## Customizing Prompts

To modify a prompt, edit the corresponding file in `src/scripts/prompts/`.

### Example: Changing the Playwright Persona

Open `src/scripts/prompts/playwright.js`:

```javascript
const COMMON = {
  // ...
  PERSONA: (language) => `
P - PERSONA:
QA engineers working with Playwright in ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} who need production-ready test code.
`
};
```

You can update the string to change how the AI behaves.

### Dynamic Prompting

Prompts are functions that take a `variables` object. This allows injecting dynamic content:

```javascript
export function getAutomationPrompt(variables) {
    // variables.domContent -> The HTML of selected elements
    // variables.pageUrl -> The current URL
    // ...
}
```

## Adding New Prompt Types

1.  Create a new file (e.g., `cypress.js`) in the `prompts` directory.
2.  Implement the `getDesignatedPrompt` function following the ICE-TOP pattern.
3.  Import and use it in `src/scripts/prompts.js`.

```javascript
// src/scripts/prompts.js
import { getDesignatedPrompt as getCypressPrompt } from './prompts/cypress.js';

// ... inside getAutomationPrompt
if (tool === 'cypress') {
    return getCypressPrompt(...);
}
```
