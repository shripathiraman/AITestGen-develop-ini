// Import the CodeGenerator class (assuming generate.js is loaded as a module or globally available)
// If generate.js is loaded via <script type="module"> in HTML, you might use:
import { CodeGenerator } from './codegenerate.js';
// For simplicity in this direct modification, we assume it's available globally or loaded before this script.

document.addEventListener('DOMContentLoaded', async () => {
  Logger.log("[Sidepanel] DOM fully loaded and parsed.");

  // Apply i18n translations
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = chrome.i18n.getMessage(key) || el.textContent;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', chrome.i18n.getMessage(key) || el.getAttribute('placeholder'));
  });

  const generatorTabBtn = document.getElementById('generator-tab');
  const settingsTabBtn = document.getElementById('settings-tab');
  const inspectBtn = document.getElementById('inspect-btn');
  const stopBtn = document.getElementById('stop-btn');
  const resetBtn = document.getElementById('reset-btn');
  const generateBtn = document.getElementById('generate-btn');
  const selectedElementsDisplay = document.getElementById('selected-elements'); // Renamed to avoid confusion with internal currentElements
  const elementCountDisplay = document.getElementById('element-count'); // Renamed for clarity

  let currentElements = [];
  let isInspecting = false;
  let codeGenerator; // Declare a variable to hold the CodeGenerator instance

  // Initialize CodeGenerator after DOM is ready
  // This assumes CodeGenerator class is defined and accessible (e.g., from generate.js loaded prior)
  if (document.getElementById('generator')) { // Check if generator tab elements are present
    codeGenerator = new CodeGenerator();
  }

  // Initialize from storage for generator-specific elements and context
  // This part now primarily focuses on `selectedElements` as `context` is managed by CodeGenerator
  chrome.storage.local.get(['selectedElements'], (result) => {
    Logger.log("[Sidepanel] Initializing Generator from storage:", result);
    if (result.selectedElements) {
      currentElements = result.selectedElements;
      Logger.log("[Sidepanel] Loaded selected elements:", currentElements);
      renderElements();
      if (codeGenerator) {
        codeGenerator.updateSelectedElements(currentElements); // Inform CodeGenerator about initial elements
      }
    }
  });

  // Tab switching
  generatorTabBtn.addEventListener('click', () => {
    Logger.log("[Sidepanel] Generator tab clicked.");
    switchTab('generator');
  });
  settingsTabBtn.addEventListener('click', () => {
    Logger.log("[Sidepanel] Settings tab clicked.");
    switchTab('settings');
  });

  // Tab switching function
  function switchTab(tabName) {
    Logger.log(`[Sidepanel] Switching to tab: ${tabName}`);
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tabs button').forEach(btn => {
      btn.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
  }

  // Inspect button
  inspectBtn.addEventListener('click', async () => {
    Logger.log("[Sidepanel] Inspect button clicked.");

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        Logger.error("No active tab found.");
        return;
      }
      // Add the new URL check here
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        Logger.log('Cannot use inspector on this page');
        alert(chrome.i18n.getMessage("alertCannotInspect") || 'Cannot use the inspector on Chrome internal pages or extension pages.');
        return; // Stop execution
      }

      // ... rest of your inspection logic (sending messages to content script) ...
      // Example of existing logic that would follow:
      try {
        await chrome.tabs.sendMessage(tab.id, { action: "startInspect" });
        if (!isInspecting) {
          isInspecting = true;
        }
        inspectBtn.disabled = true;
        stopBtn.disabled = false;
        generateBtn.disabled = true;
        Logger.log("[Sidepanel] Sent startInspect message.");
      } catch (error) {
        Logger.error("[Sidepanel] Error sending startInspect message:", error);

        // Check if the error is due to missing content script
        if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
          Logger.log("[Sidepanel] Content script not found. Attempting to inject...");
          try {
            // Dynamically inject the scripts
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/scripts/log.js', 'src/content_scripts/content.js']
            });
            // Inject CSS as well
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['src/content_scripts/inspect.css']
            });

            Logger.log("[Sidepanel] Scripts injected. Retrying startInspect...");
            // Retry sending the message
            await chrome.tabs.sendMessage(tab.id, { action: "startInspect" });

            if (!isInspecting) {
              isInspecting = true;
            }
            inspectBtn.disabled = true;
            stopBtn.disabled = false;
            generateBtn.disabled = true;
            Logger.log("[Sidepanel] Sent startInspect message after injection.");

          } catch (retryError) {
            Logger.error("[Sidepanel] Failed to inject/retry:", retryError);
            alert(chrome.i18n.getMessage("alertFailedStart") || 'Failed to start inspector. Please refresh the web page and try again.');
          }
        } else {
          alert('Failed to start inspector: ' + error.message);
        }
      }
    });
  });

  // Stop button
  stopBtn.addEventListener('click', () => {
    Logger.log("[Sidepanel] Stop button clicked.");
    stopInspection();
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    const confirmReset = confirm(chrome.i18n.getMessage("alertConfirmReset") || "Are you sure you want to reset? This will clear all selected elements, context, and generated output.");
    if (confirmReset) {
      Logger.log("[Sidepanel] Reset confirmed by user.");
      stopInspection();

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        Logger.log("[Sidepanel] Sending resetInspect message to content script.");
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "resetInspect" }, () => {
            // Check for errors (e.g., content script not found) but proceed with local reset
            if (chrome.runtime.lastError) {
              Logger.warn("[Sidepanel] Could not send resetInspect (content script might be missing), but proceeding with local reset:", chrome.runtime.lastError.message);
            }

            currentElements = [];
            renderElements();
            // Reset context and output area via CodeGenerator if it exists
            if (codeGenerator && codeGenerator.elements['context-input']) {
              codeGenerator.elements['context-input'].value = '';
            }
            // Clear all output textareas and previews
            document.querySelectorAll('.output-tab-content textarea').forEach(ta => ta.value = '');
            document.querySelectorAll('.output-tab-content .output-preview-box').forEach(p => p.innerHTML = '');
            // Reset tab states
            document.querySelectorAll('.output-tab').forEach(t => { t.classList.remove('active'); t.style.display = 'none'; });
            document.querySelectorAll('.output-tab-content').forEach(c => c.style.display = 'none');
            // Hide stats
            const statsEl = document.getElementById('stats-display');
            if (statsEl) statsEl.style.display = 'none';
            // Hide entire output section
            if (codeGenerator && codeGenerator.elements['output-section']) {
              codeGenerator.elements['output-section'].style.display = 'none';
            }
            chrome.storage.local.remove(['selectedElements', 'context']);
            Logger.log("[Sidepanel] Cleared selected elements, context, and output from storage.");
          });
        }
      });
    } else {
      Logger.log("[Sidepanel] Reset canceled by user.");
    }
  });

  // Stop inspection function
  function stopInspection() {
    Logger.log("[Sidepanel] Stopping inspection.");
    isInspecting = false;
    inspectBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        Logger.log("[Sidepanel] Sending stopInspect message to content script.");
        chrome.tabs.sendMessage(tabs[0].id, { action: "stopInspect" }, () => {
          if (chrome.runtime.lastError) {
            Logger.warn("[Sidepanel] Could not send stopInspect (content script might be missing):", chrome.runtime.lastError.message);
          }
        });
      }
    });
  }

  // Render selected elements
  function renderElements() {
    Logger.log("[Sidepanel] Rendering selected elements:", currentElements);
    selectedElementsDisplay.innerHTML = '';
    elementCountDisplay.textContent = currentElements.length;

    currentElements.forEach((element, index) => {
      const elemDiv = document.createElement('div');
      elemDiv.className = 'element-item';
      elemDiv.innerHTML = `
        ${element.name || element.selector}
        <span class="remove" data-index="${index}">×</span>
      `;
      selectedElementsDisplay.appendChild(elemDiv);
    });

    document.querySelectorAll('.element-item .remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        Logger.log(`[Sidepanel] Removing element at index ${index}.`);

        if (index >= 0 && index < currentElements.length) {
          const selectorToRemove = currentElements[index].selector;

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "removeHighlight",
                selector: selectorToRemove
              }, (response) => {
                if (chrome.runtime.lastError) {
                  Logger.error("[Sidepanel] Error sending removeHighlight:", chrome.runtime.lastError);
                } else {
                  Logger.log("[Sidepanel] Remove highlight response:", response);
                  currentElements.splice(index, 1);
                  chrome.storage.local.set({ selectedElements: currentElements }, () => {
                    renderElements();
                    if (codeGenerator) {
                      codeGenerator.updateSelectedElements(currentElements); // Update CodeGenerator
                    }
                  });
                }
              });
            }
          });
        } else {
          Logger.error("[Sidepanel] Invalid index for removal:", index);
        }
      });
    });
  }

  // Listen for element selections from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    Logger.log("[Sidepanel] Received message from content script:", request);
    if (request.action === "elementSelected") {
      currentElements.push({
        selector: request.selector,
        name: request.name,
        xpath: request.xpath,
        html: request.html,
        attributes: request.attributes || {}
      });
      chrome.storage.local.set({ selectedElements: currentElements });
      renderElements();
      if (codeGenerator) {
        codeGenerator.updateSelectedElements(currentElements); // Inform CodeGenerator
      }
    } else if (request.action === "updateSelectedElements") {
      currentElements = request.elements.map(element => ({
        selector: element.selector,
        name: element.name,
        xpath: element.xpath,
        html: element.html,
        attributes: element.attributes || {}
      }));
      chrome.storage.local.set({ selectedElements: currentElements }, () => {
        try {
          renderElements();
          if (codeGenerator) {
            codeGenerator.updateSelectedElements(currentElements); // Inform CodeGenerator
          }
          sendResponse({ status: "elements updated" });
        } catch (error) {
          Logger.error("[Sidepanel] Error updating elements:", error);
          sendResponse({ status: "error", error: error.message });
        }
      });
      return true; // Indicate that sendResponse will be called asynchronously
    }
    // Only send response for "elementSelected" if it's not handled by "updateSelectedElements"
    // For other unhandled actions, it's better not to send a response if not explicitly needed
    if (request.action !== "updateSelectedElements") {
      Logger.log("[Sidepanel] Action not recognized or handled elsewhere:", request.action);
      sendResponse({ status: "unknown action or already handled" });
    }
  });
});