/**
 * Prompts for Playwright Automation Tool
 * Implements ICE-TOP Framework (Instruction, Context, Example, Tone, Output, Persona)
 */

const STRICT_RULES = `
- [CRITICAL]: Use the pre-calculated \`playwrightLocator\` field (modern locators like getByRole/getByLabel/getByTestId) for EVERY element interaction. Do NOT invent locators
- Include proper async/await patterns throughout
- Use France realistic dataset: names (Marie Martin, Lucas Bernard), addresses (24 Rue de l’Exposition, Paris), mobile (+33-6-12-34-56-78), pin codes (75007 (Paris), 75001 (Paris), 69002 (Lyon), 06300 (Nice))
- Use dropdown values ONLY from provided DOM options
- Test name should be descriptive based on functionality
- Include proper waits and error handling`;

const COMMON = {
  CONTEXT: `
C - CONTEXT:
DOM:
\${domContent}

Page URL: \${pageUrl}
`,
  TONE: `
T - TONE:
Professional, modern async-first, fully executable.
`,
  PERSONA: (language) => `
P - PERSONA:
QA engineers working with Playwright in ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} who need production-ready test code.
`
};

const EXAMPLES = {
  INPUT_DOM: `
E - EXAMPLE (Input DOM):
\`\`\`html
<form>
  <input name="username" placeholder="Username">
  <input name="password" type="password" placeholder="Password">
  <button>Login</button>
</form>
\`\`\`
`,
  OUTPUT_SCRIPT: (language) => {
    const isTS = language === 'typescript';
    return `
E - EXAMPLE (Output):
\`\`\`${language}
[[START_TEST_SCRIPT]]
${isTS ? "import { test, expect } from '@playwright/test';" : "const { test, expect } = require('@playwright/test');"}

test('user can login with valid credentials', async ({ page }) => {
  // Navigate to login page
  await page.goto('\${pageUrl}');
  
  // Fill login form
  await page.getByPlaceholder('Username').fill('Ravi Kumar');
  await page.getByPlaceholder('Password').fill('TestPass@123');
  
  // Submit form
  await page.getByRole('button', { name: 'Login' }).click();
  
  // Verify successful login
  await expect(page).toHaveURL(/.*dashboard/);
});
[[END_TEST_SCRIPT]]
\`\`\`
`
  },
  OUTPUT_POM_AND_SCRIPT: (language) => {
    const isTS = language === 'typescript';
    const typeAnnot = (type) => isTS ? `: ${type}` : '';

    return `
E - EXAMPLE (Output):
\`\`\`${language}
[[START_POM]]
// LoginPage.${isTS ? 'ts' : 'js'}
${isTS ? "import { Page, Locator } from '@playwright/test';" : ""}

${isTS ? 'export ' : ''}class LoginPage {
  ${isTS ? 'readonly page: Page;' : ''}
  
  constructor(page${typeAnnot('Page')}) {
    this.page = page;
  }
  
  async navigate() {
    await this.page.goto('\${pageUrl}');
    return this;
  }
  
  async fillUsername(username${typeAnnot('string')}) {
    await this.page.getByPlaceholder('Username').fill(username);
    return this;
  }
  
  async fillPassword(password${typeAnnot('string')}) {
    await this.page.getByPlaceholder('Password').fill(password);
    return this;
  }
  
  async clickLogin() {
    await this.page.getByRole('button', { name: 'Login' }).click();
    return this;
  }
}
${!isTS ? 'module.exports = { LoginPage };' : ''}
[[END_POM]]
\`\`\`

\`\`\`${language}
[[START_TEST_SCRIPT]]
// login.test.${isTS ? 'ts' : 'js'}
${isTS ? "import { test, expect } from '@playwright/test';" : "const { test, expect } = require('@playwright/test');"}
${isTS ? "import { LoginPage } from './LoginPage';" : "const { LoginPage } = require('./LoginPage');"}

test('user can login with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.fillUsername('Ravi Kumar');
  await loginPage.fillPassword('TestPass@123');
  await loginPage.clickLogin();
  
  await expect(page).toHaveURL(/.*dashboard/);
});
[[END_TEST_SCRIPT]]
\`\`\`
`
  }
};

/**
 * Generates a Playwright prompt based on language and mode.
 * @param {string} language - 'typescript' | 'javascript'
 * @param {object} options - { includePom: boolean }
 * @returns {string} The formatted prompt adhering to ICE-TOP.
 */
export const getDesignatedPrompt = (language, { includePom } = {}) => {
  // Validate inputs
  if (!['typescript', 'javascript'].includes(language)) {
    throw new Error(`Unsupported language: ${language}. Only 'typescript' and 'javascript' are supported.`);
  }

  const langName = language === 'typescript' ? 'TypeScript' : 'JavaScript';

  // Build Sections

  // I - INSTRUCTION
  let instruction = `
I - INSTRUCTION:
Generate a complete Playwright ${langName} ${includePom ? 'Solution (Page Object Model + Test Script)' : 'test file'} for the provided DOM. Follow these rules strictly:
${STRICT_RULES}
`;
  if (includePom) {
    instruction += `- Implement Page Object Model class isolating locators and actions
- Encapsulate all locators as private methods or properties
- Return 'this' from action methods for method chaining
- Create a separate test file that uses the Page Object
`;
  } else {
    instruction += `- Add test setup (page navigation) and proper assertions
- Keep all logic in a single test file
`;
  }

  // C - CONTEXT
  const context = COMMON.CONTEXT;

  // E - EXAMPLE
  const exampleInput = EXAMPLES.INPUT_DOM;
  const exampleOutput = includePom ? EXAMPLES.OUTPUT_POM_AND_SCRIPT(language) : EXAMPLES.OUTPUT_SCRIPT(language);

  // T - TONE
  const tone = COMMON.TONE;

  // O - OUTPUT
  let outputFormat = `
O - OUTPUT FORMAT:
`;
  if (includePom) {
    outputFormat += `Provide TWO code blocks:
1. The Page Object Model class in ${langName} wrapped in [[START_POM]] and [[END_POM]]
2. The Test Script in ${langName} that imports and uses the Page Object wrapped in [[START_TEST_SCRIPT]] and [[END_TEST_SCRIPT]]
No explanations.`;
  } else {
    outputFormat += `ONLY ${langName} code in a single ${language} code block wrapped in [[START_TEST_SCRIPT]] and [[END_TEST_SCRIPT]]. No explanations.`;
  }

  // P - PERSONA
  const persona = COMMON.PERSONA(language);

  // Combine all sections
  return [
    instruction,
    context,
    exampleInput,
    exampleOutput,
    tone,
    outputFormat,
    persona
  ].join('').trim();
};
