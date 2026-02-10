// background.js
// This script acts as the service worker for the Chrome extension.
// It handles global, long-running tasks, communications not directly
// between content/sidepanel, and manages extension lifecycle events.

importScripts('../scripts/log.js');

// --- Internal Debugging Logger ---
// Using centralized Logger from log.js
// Logger.debug = true; // Uncomment to force debug mode if needed locally
Logger.log("Background script initialized.");

// --- Constants for Message Actions ---
// Using constants for message action strings reduces typos and improves maintainability.
const ACTIONS = {
    START_INSPECT: "startInspect",
    STOP_INSPECT: "stopInspect",
    RESET_INSPECT: "resetInspect",
    REMOVE_HIGHLIGHT: "removeHighlight",
    CLEAR_ALL: "clearAll",
    UPDATE_SELECTED_ELEMENTS: "updateSelectedElements",
    // Add any other actions handled by the background script here
    PROXY_LLM_REQUEST: "proxyLlmRequest" // Example for future LLM integration via background
};

// --- Service Worker Lifecycle & Initialization ---

/**
 * @description Sets the behavior for the side panel, allowing it to open
 * directly when the extension's action button is clicked.
 * This is an immediate action taken when the service worker starts up.
 */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .then(() => Logger.log("Side panel behavior set successfully (openPanelOnActionClick: true)."))
    .catch((error) => Logger.log("ERROR: Failed to set side panel behavior:", error));

/**
 * @description Listens for the extension's installation or update event.
 * On these events, it clears specific local storage data to ensure a clean slate.
 * Using `remove` instead of `clear` for targeted cleanup.
 * @param {object} details - Contains information about the reason for the event.
 */
chrome.runtime.onInstalled.addListener((details) => {
    Logger.log(`Extension installed or updated. Reason: ${details.reason}.`);
    // Clear only specific, volatile data on install/update to retain other potential settings.
    chrome.storage.local.remove(['selectedElements', 'context'])
        .then(() => Logger.log("Cleared 'selectedElements' and 'context' from storage on install/update."))
        .catch(error => Logger.log("ERROR: Failed to clear storage on install/update:", error));
});

/**
 * @description Initializes specific local storage keys with default values if they don't exist.
 * This is a good practice to ensure expected data structures are present.
 * This listener runs every time the service worker activates.
 */
chrome.runtime.onStartup.addListener(() => {
    Logger.log("Service worker starting up. Initializing storage defaults.");
    // Initialize with default values if not already present.
    // `set` merges, so it won't overwrite existing values.
    chrome.storage.local.set({ selectedElements: [], context: "" })
        .then(() => Logger.log("Storage defaults for selectedElements and context ensured."))
        .catch(error => Logger.log("ERROR: Failed to ensure storage defaults:", error));
});

// --- Message Handling ---

/**
 * @description Central message listener for communications from content scripts or the side panel.
 * In this architecture, the background script largely acts as a passive observer
 * or a proxy for requests that require higher permissions (e.g., external API calls).
 * Direct content script <-> side panel communication is preferred where possible.
 * @param {object} message - The message payload.
 * @param {MessageSender} sender - Information about the sender of the message.
 * @param {function} sendResponse - Function to send a response back to the sender.
 * @returns {boolean} - True if `sendResponse` will be called asynchronously.
 */
const messageListener = async (message, sender, sendResponse) => {
    Logger.log("Received message in background script:", message);

    // If the background script needs to handle a specific action
    // that isn't directly handled by sidepanel.js or content.js,
    // this is where the logic would go.

    // Example: A message for the background script to make an LLM API call (future feature)
    if (message.action === ACTIONS.PROXY_LLM_REQUEST) {
        Logger.log("Handling PROXY_LLM_REQUEST. (Future LLM API call logic would go here).");
        // Example: Fetch API key from storage, make fetch request, send response.
        try {
            const settings = await chrome.storage.local.get(['apiKey', 'llmProvider', 'llmModel']);
            // Placeholder for actual LLM API call
            const llmResponse = { status: 'success', data: 'Generated code snippet from LLM' };
            sendResponse({ status: "processed", response: llmResponse });
        } catch (error) {
            Logger.log("ERROR: Failed to proxy LLM request:", error);
            sendResponse({ status: "error", message: error.message });
        }
        return true; // Indicates async response
    }

    // Default: Log unhandled messages. For this extension, most messages are direct
    // between content.js and sidepanel.js, so the background just observes.
    Logger.log("INFO: Message action not directly handled by background script (likely direct content/sidepanel communication).");
    sendResponse({ status: "unhandled" });
    return false; // No async response needed for unhandled messages
};

// Register the message listener. This should be added only once.
chrome.runtime.onMessage.addListener(messageListener);
Logger.log("chrome.runtime.onMessage listener registered.");

// --- Cleanup and Lifecycle Management ---

/**
 * @description Central cleanup function for the background script.
 * This is triggered when the service worker is about to suspend/become inactive.
 * It's crucial for releasing resources and ensuring a clean state.
 */
async function cleanupExtension() {
    Logger.log("Starting background script cleanup (onSuspend/unload).");

    // Remove the message listener to prevent memory leaks if the service worker unloads.
    // This is important as `onSuspend` can sometimes lead to full unload.
    try {
        chrome.runtime.onMessage.removeListener(messageListener);
        Logger.log("chrome.runtime.onMessage listener removed.");
    } catch (error) {
        Logger.log("WARN: Error removing message listener (might have already been removed or not active):", error);
    }

    // Send a `clearAll` message to all currently active tabs.
    // This ensures highlights are cleared on pages where the extension might have been active.
    // This is a robust cleanup measure when the extension itself is going dormant.
    try {
        const tabs = await chrome.tabs.query({}); // Query all tabs
        Logger.log(`Sending CLEAR_ALL message to ${tabs.length} tabs for cleanup.`);
        tabs.forEach(tab => {
            if (tab.id) {
                // Using `catch` here because tabs might close before message is received,
                // leading to `chrome.runtime.lastError`.
                chrome.tabs.sendMessage(tab.id, { action: ACTIONS.CLEAR_ALL })
                    .catch(err => Logger.log(`INFO: Could not send CLEAR_ALL to tab ${tab.id} (likely closed or unresponsive):`, err.message));
            }
        });
    } catch (error) {
        Logger.log("ERROR: Failed to query tabs or send CLEAR_ALL message during cleanup:", error);
    }

    // You could also clear specific storage data here if needed,
    // but `onInstalled` already handles an initial clear.
    // E.g., `await chrome.storage.local.remove(['volatileData']);`
    Logger.log("Background script cleanup complete.");
}

/**
 * @description Listens for the `onSuspend` event, which indicates that the
 * service worker is about to become inactive. This is the primary trigger for cleanup.
 */
chrome.runtime.onSuspend.addListener(() => {
    Logger.log("Extension suspending (onSuspend event). Triggering cleanup.");
    cleanupExtension();
});

// --- Removed/Revised Elements from Original Script ---

// Removed `isShuttingDown` flag:
// In Manifest V3 service workers, `onSuspend` is the primary mechanism for detecting
// impending unload. The `isShuttingDown` flag adds complexity and is often unnecessary
// given the event-driven nature of service workers.

// Removed `chrome.storage.local.clear()` from `cleanupExtension`:
// Changed to specific `remove` on `onInstalled` for better data persistence.
// A full `clear()` on suspend could delete user settings unexpectedly.

// Removed `setInterval` for periodic cleanup:
// `setInterval` is unreliable in Manifest V3 service workers as they suspend when idle.
// If persistent periodic tasks are needed, `chrome.alarms` API should be used.
// For this extension, `onInstalled` and `onSuspend` provide sufficient cleanup.
