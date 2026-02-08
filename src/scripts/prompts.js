import { getDesignatedPrompt as getPlaywrightPrompt } from './prompts/playwright.js';
import { getDesignatedPrompt as getSeleniumPrompt } from './prompts/selenium.js';
import { ManualPrompts } from './prompts/manual.js';
import { GherkinPrompts } from './prompts/gherkin.js';

export const PROMPTS = {
  manual: ManualPrompts,
  gherkin: GherkinPrompts
};

/**
 * Generates prompt for Manual or Gherkin test generation.
 */
export function getManualGherkinPrompt(variables) {
  const context = variables.userAction || "No specific action provided";

  let masterInstructions = `You are an expert QA Automation Engineer / Business Analyst / Operational User / Change Manager.

USER CONTEXT: ${context}
PAGE URL: ${variables.pageUrl}

--------------------------------------------------
EXECUTE THE FOLLOWING TASKS:
--------------------------------------------------
`;

  if (variables.requirements.manual) {
    masterInstructions += `TASK: [Manual Test Generation]
${PROMPTS.manual.MANUAL_TEST}
[RULE] Wrap the response strictly inside [[START_MANUAL_TEST]] and [[END_MANUAL_TEST]].
`;
  } else if (variables.requirements.feature) {
    masterInstructions += `TASK: [Gherkin Feature Generation]
${PROMPTS.gherkin.FEATURE}
[RULE] Wrap the response strictly inside [[START_FEATURE_FILE]] and [[END_FEATURE_FILE]].
`;
  }

  masterInstructions += `[CRITICAL] Provide professional, executable results.`;
  return masterInstructions
    .replace(/\${pageUrl}/g, variables.pageUrl)
    .replace(/\${domContent}/g, variables.domContent);
}

/**
 * Generates prompt for Automation Script generation (Playwright/Selenium).
 */
export function getAutomationPrompt(variables) {
  const tool = variables.tool || "Playwright";
  const lang = variables.lang || "TypeScript";

  if (tool.toLowerCase() === 'playwright') {
    return getPlaywrightPrompt(lang.toLowerCase(), {
      includePom: variables.requirements.pom
    })
      .replace(/\${pageUrl}/g, variables.pageUrl)
      .replace(/\${domContent}/g, variables.domContent);
  } else if (tool.toLowerCase() === 'selenium') {
    return getSeleniumPrompt(lang.toLowerCase(), {
      includePom: variables.requirements.pom
    })
      .replace(/\${pageUrl}/g, variables.pageUrl)
      .replace(/\${domContent}/g, variables.domContent);
  }

  throw new Error(`Unsupported tool: ${tool}`);
}
