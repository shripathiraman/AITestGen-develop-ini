/**
 * Prompt for Manual Test Cases
 */
export const ManualPrompts = {
  MANUAL_TEST: `
I - INSTRUCTION:
Generate ONLY manual test cases for the provided DOM in a structured table format. Follow these rules strictly:
- Use Test Case ID, Description, Preconditions, Test Steps (numbered), Expected Result
- Every step must reference elements existing in the provided DOM
- Do not combine multiple actions into one step (one action per step)
- Use France & South India realistic dataset: 
  - South India data set - names (Ravi Kumar, Priya Menon, Arun Suresh, Lakshmi Iyer, Venkat Reddy), addresses (MG Road Bangalore 560001, Anna Salai Chennai 600001, Marine Drive Kochi 682001), mobile (+91-9845000001 to +91-9845000005), pin codes (560001, 600001, 682001, 500001, 641001)
  - France data set names (Marie Martin, Lucas Bernard), addresses (24 Rue de l’Exposition, Paris), mobile (+33-6-12-34-56-78), pin codes (75007 (Paris), 75001 (Paris), 69002 (Lyon), 06300 (Nice))
- Use dropdown values ONLY from provided DOM options
- Test Case title: "<AppName> <Functionality>" from DOM title/form labels
- Create 3-5 test cases covering positive scenarios with data variations
- Generate separate test cases if different data types/flow variations exist

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
  </select>  
  <input name="name" placeholder="Full Name">  
  <input name="pincode" placeholder="PIN Code">  
  <button>Submit</button>  
</form>
\`\`\`

E - EXAMPLE (Output):

| Test Case ID | **TC_USER_001** |
| :--- | :--- |
| **Description** | Fill user registration form with valid Karnataka data |
| **Preconditions** | User registration page is open |
| **Test Data** | State: KA, Name: Ravi Kumar, Pincode: 560001 |

| **Test Steps** | **Expected Result** |
| :--- | :--- |
| 1. Select "KA" from State dropdown | Karnataka is selected |
| 2. Enter "Ravi Kumar" in Full Name field | Name field shows "Ravi Kumar" |
| 3. Enter "560001" in PIN Code field | Pincode field shows "560001" |
| 4. Click Submit button | Form submits successfully with confirmation |

---

| Test Case ID | **TC_USER_002** |
| :--- | :--- |
| **Description** | Fill user registration form with valid Kerala data |
| **Preconditions** | User registration page is open |
| **Test Data** | State: KL, Name: Priya Menon, Pincode: 682001 |

| **Test Steps** | **Expected Result** |
| :--- | :--- |
| 1. Select "KL" from State dropdown | Kerala is selected |
| 2. Enter "Priya Menon" in Full Name field | Name field shows "Priya Menon" |
| 3. Enter "682001" in PIN Code field | Pincode field shows "682001" |
| 4. Click Submit button | Form submits successfully with confirmation |

[RULE] Ensure distinct vertical spacing (blank line) and a horizontal rule \`---\` between EACH test case. Use \`| :--- | :--- |\` for alignment on EVERY standalone table block.

T - TONE:
Clear, structured, executable manual test cases for QA testers.

O - OUTPUT FORMAT [CRITICAL — MUST FOLLOW EXACTLY FOR EVERY TEST CASE]:
- ONLY markdown tables. No explanations, no code fences, no additional text outside tables.
- Each test step MUST be on its own table row. NEVER use \`||\` to separate steps on a single line.
- Bold text MUST use \`**text**\` with NO space after the opening \`**\`. Example: \`**Expected Result**\` ✅, \`** Result**\` ❌
- EVERY table block MUST include the alignment row \`| :--- | :--- |\` immediately after the header row.
- Separate each test case with a blank line and a horizontal rule \`---\`.

P - PERSONA:
QA testers who need ready-to-execute manual test cases for test execution.
The test cases should be easily understandable by non-technical stakeholders as well.
`
};
