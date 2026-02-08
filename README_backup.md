# AITestGen
Inspect & Capture-Based Test Case Generator
Overview
This browser extension allows users to manually inspect and highlight DOM elements to generate:
- Feature or Manual Test Cases
- Test Page Code
- Automation Test Scripts (Selenium/Playwright)
Core Functionalities
- Manual Element Selection: Users highlight specific elements for test generation.
- AI-Generated Test Cases & Scripts: Converts inspected DOM elements into structured test cases.
- Error Detection & Optimization: Ensures test cases are reliable and well-structured.
- Auto-XPath Suggestions: AI suggests optimized selectors for stability.
Tab 1: Main Functionalities
- Checkbox Selection:
- Feature/Manual Test Case
- Test Page Code
- Test Script
- At least one checkbox must be selected to generate output.
- Inspect Button:
- Users highlight elements (amber color) for selection.
- Stop Button:
- Stops selection but retains inspected elements for test case generation.
- Reset Button:
- Clears selections, DOM highlights, and stored data.
- Editable Input Area:
- Users provide additional context to AI before generation.
- Generate Button:
- Validates Tab 2 settings before execution.
- Output Display:
- Shows AI-generated test cases in a non-editable text area.
- Copy & Download Buttons:
- Allows saving feature files, test page files, and test scripts locally.
Tab 2: Settings
- Language Dropdown: TypeScript (default), Java, C#, Python.
- Automation Tool Selection: Playwright (default), Selenium.
- LLM Provider & Model Dropdown: Dynamic update based on selection (Groq, OpenAI, Testleaf).
- API Key Input: Password-styled field.
- Multi-Page Toggle: Capture elements across multiple pages or single-page selection.
- Test Case Output Format: Manual Test vs. Feature File.
- Save Settings Button: Stores user preferences for reuse.
- Test Execution Mode Toggle: Runs generated test scripts for validation.
Future Enhancements
- Jira & Git Integration
- Test Data Generation
