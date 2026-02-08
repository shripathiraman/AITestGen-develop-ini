/**
 * Prompts for Selenium Automation Tool
 * Implements ICE-TOP Framework (Instruction, Context, Example, Tone, Output, Persona)
 */

const STRICT_RULES = `
- Use modern Selenium locators (By.id, By.name, By.cssSelector, By.xpath relevant to the element)
- Include proper explicit waits (WebDriverWait) for element visibility/interactability
- Use France realistic dataset: names (Marie Martin, Lucas Bernard), addresses (24 Rue de l’Exposition, Paris), mobile (+33-6-12-34-56-78), pin codes (75007 (Paris), 75001 (Paris), 69002 (Lyon), 06300 (Nice))
- Use dropdown values ONLY from provided DOM options
- Test name should be descriptive based on functionality
- Include proper error handling and driver teardown (using try-finally or fixtures/annotations)`;

const COMMON = {
    CONTEXT: `
C - CONTEXT:
DOM:
\${domContent}

Page URL: \${pageUrl}
`,
    TONE: `
T - TONE:
Professional, modern object-oriented, fully executable.
`,
    PERSONA: (language) => `
P - PERSONA:
QA engineers working with Selenium in ${language === 'java' ? 'Java' : 'Python'} who need production-ready test code.
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
        const isJava = language === 'java';
        return `
E - EXAMPLE (Output):
\`\`\`${language}
[[START_TEST_SCRIPT]]
${isJava ? `import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class LoginTest {
    @Test
    public void userCanLoginWithValidCredentials() {
        WebDriver driver = new ChromeDriver();
        try {
            // Navigate to login page
            driver.get("\${pageUrl}");
            WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

            // Fill login form
            WebElement usernameInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("username")));
            usernameInput.sendKeys("Marie Martin");

            WebElement passwordInput = driver.findElement(By.name("password"));
            passwordInput.sendKeys("TestPass@123");

            // Submit form
            driver.findElement(By.tagName("button")).click();

            // Verify successful login
            wait.until(ExpectedConditions.urlContains("dashboard"));
        } finally {
            driver.quit();
        }
    }
}` : `import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    yield driver
    driver.quit()

def test_user_can_login_with_valid_credentials(driver):
    # Navigate to login page
    driver.get("\${pageUrl}")
    wait = WebDriverWait(driver, 10)

    # Fill login form
    username_input = wait.until(EC.visibility_of_element_located((By.NAME, "username")))
    username_input.send_keys("Marie Martin")

    password_input = driver.find_element(By.NAME, "password")
    password_input.send_keys("TestPass@123")

    # Submit form
    driver.find_element(By.TAG_NAME, "button").click()

    # Verify successful login
    wait.until(EC.url_contains("dashboard"))`}
[[END_TEST_SCRIPT]]
\`\`\`
`
    },
    OUTPUT_POM_AND_SCRIPT: (language) => {
        const isJava = language === 'java';

        return `
E - EXAMPLE (Output):
\`\`\`${language}
[[START_POM]]
// LoginPage.${isJava ? 'java' : 'py'}
${isJava ? `import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class LoginPage {
    private WebDriver driver;
    private WebDriverWait wait;

    private By usernameLocator = By.name("username");
    private By passwordLocator = By.name("password");
    private By loginButtonLocator = By.tagName("button");

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public LoginPage navigate() {
        driver.get("\${pageUrl}");
        return this;
    }

    public LoginPage fillUsername(String username) {
        wait.until(ExpectedConditions.visibilityOfElementLocated(usernameLocator)).sendKeys(username);
        return this;
    }

    public LoginPage fillPassword(String password) {
        driver.findElement(passwordLocator).sendKeys(password);
        return this;
    }

    public LoginPage clickLogin() {
        driver.findElement(loginButtonLocator).click();
        return this;
    }
}` : `from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class LoginPage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)
        self.username_locator = (By.NAME, "username")
        self.password_locator = (By.NAME, "password")
        self.login_button_locator = (By.TAG_NAME, "button")

    def navigate(self):
        self.driver.get("\${pageUrl}")
        return self

    def fill_username(self, username):
        self.wait.until(EC.visibility_of_element_located(self.username_locator)).send_keys(username)
        return self

    def fill_password(self, password):
        self.driver.find_element(*self.password_locator).send_keys(password)
        return self

    def click_login(self):
        self.driver.find_element(*self.login_button_locator).click()
        return self`}
[[END_POM]]
\`\`\`

\`\`\`${language}
[[START_TEST_SCRIPT]]
// LoginTest.${isJava ? 'java' : 'py'}
${isJava ? `import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

public class LoginTest {
    @Test
    public void userCanLoginWithValidCredentials() {
        WebDriver driver = new ChromeDriver();
        try {
            LoginPage loginPage = new LoginPage(driver);
            loginPage.navigate()
                     .fillUsername("Marie Martin")
                     .fillPassword("TestPass@123")
                     .clickLogin();

            new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.urlContains("dashboard"));
        } finally {
            driver.quit();
        }
    }
}` : `import pytest
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
# from login_page import LoginPage

@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    yield driver
    driver.quit()

def test_user_can_login_with_valid_credentials(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.fill_username("Marie Martin")
    login_page.fill_password("TestPass@123")
    login_page.click_login()

    WebDriverWait(driver, 10).until(EC.url_contains("dashboard"))`}
[[END_TEST_SCRIPT]]
\`\`\`
`
    }
};

/**
 * Generates a Selenium prompt based on language and mode.
 * @param {string} language - 'java' | 'python'
 * @param {object} options - { includePom: boolean }
 * @returns {string} The formatted prompt adhering to ICE-TOP.
 */
export const getDesignatedPrompt = (language, { includePom } = {}) => {
    // Validate inputs
    if (!['java', 'python'].includes(language)) {
        throw new Error(`Unsupported language: ${language}. Only 'java' and 'python' are supported.`);
    }

    const langName = language === 'java' ? 'Java' : 'Python';

    // Build Sections

    // I - INSTRUCTION
    let instruction = `
I - INSTRUCTION:
Generate a complete Selenium ${langName} ${includePom ? 'Solution (Page Object Model + Test Script)' : 'test file'} for the provided DOM. Follow these rules strictly:
${STRICT_RULES}
`;
    if (includePom) {
        instruction += `- Implement Page Object Model class isolating locators and actions
- Encapsulate all locators as private/protected fields
- Return 'this' (or self) from action methods for method chaining where appropriate
- Create a separate test file that uses the Page Object
`;
    } else {
        instruction += `- Add test setup (driver initialization) and proper assertions
- Keep all logic in a single test file/class
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
