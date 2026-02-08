/**
 * Prompt for Gherkin/Cucumber Feature Files
 */
export const GherkinPrompts = {
  FEATURE: `
I - INSTRUCTION: 
Generate ONLY a Cucumber (.feature) file for the provided DOM. Follow these rules strictly:
- Use Scenario Outline with Examples table (3-5 rows maximum)
- Every step must reference elements existing in the provided DOM
- Do not combine multiple actions into one step (one action per step)
- Use France & South India realistic dataset: 
  - South India data set - names (Ravi Kumar, Priya Menon, Arun Suresh, Lakshmi Iyer, Venkat Reddy), addresses (MG Road Bangalore 560001, Anna Salai Chennai 600001, Marine Drive Kochi 682001), mobile (+91-9845000001 to +91-9845000005), pin codes (560001, 600001, 682001, 500001, 641001)
  - France data set names (Marie Martin, Lucas Bernard), addresses (24 Rue de l’Exposition, Paris), mobile (+33-6-12-34-56-78), pin codes (75007 (Paris), 75001 (Paris), 69002 (Lyon), 06300 (Nice))
- Use dropdown values ONLY from provided DOM options
- Feature name: "<AppName> <Functionality>" from DOM title/form labels
- Add Background section for common preconditions if they exist in DOM
- Generate multiple Scenario Outlines if different data types/flow variations exist

C - CONTEXT: 
DOM:
\${domContent}

Page URL: \${pageUrl}

E - EXAMPLE (Input DOM):
\`\`\`html
<form data-testid="user-form">
  <select name="state">
    <option value="KA">Karnataka</option>
    <option value="KL">Kerala</option>
    <option value="TN">Tamil Nadu</option>
  </select>
  <input name="name" placeholder="Full Name">
  <input name="pincode" placeholder="PIN Code">
  <button>Submit</button>
</form>
\`\`\`

E - EXAMPLE (Output):
\`\`\`gherkin
Feature: User Registration Form Submission

Background: 
  Given I open the registration page

Scenario Outline: Fill user registration form with valid South India data
  When I select "<state>" from the State dropdown
  And I type "<name>" into the Full Name field  
  And I type "<pincode>" into the PIN Code field
  And I click the Submit button
  Then the form should submit successfully

Examples:
  | state | name          | pincode |
  | KA    | Ravi Kumar    | 560001  |
  | KL    | Priya Menon   | 682001  |
  | TN    | Arun Suresh   | 600001  |
\`\`\`

T - TONE:
Clear, structured, executable Gherkin for BDD testers.

O - OUTPUT FORMAT:
ONLY valid Gherkin syntax in a single gherkin code block. No explanations, no additional text.

P - PERSONA:
BDD testers who need ready-to-use .feature files for step definition development. 
The feature file should be easily understandable by non-technical stakeholders as well.
`
};
