// content.js
// This script is injected into web pages to facilitate element inspection for a browser extension.

// Ensure the ElementInspector is initialized only once per page load to prevent conflicts and redundant listeners.
if (!window.elementInspector) {
    /**
     * @function throttle
     * @description Limits how often a function can be called. Useful for performance-sensitive events
     * like `mousemove` to prevent excessive DOM manipulations and improve responsiveness.
     * @param {Function} fn - The function to throttle.
     * @param {number} delay - The minimum time (in milliseconds) between successive calls.
     * @returns {Function} - A new function that, when called, will invoke `fn` only after `delay` has passed
     * since its last invocation.
     */
    function throttle(fn, delay) {
        let lastCall = 0; // Timestamp of the last time the function was actually called
        return function (...args) {
            const now = Date.now(); // Current timestamp
            // If not enough time has passed since the last call, skip this invocation.
            if (now - lastCall < delay) {
                // Using a direct Logger.log here as `_log` is part of the class, and this throttle
                // is outside, but the message itself is informative for debugging performance.
                Logger.log("[ElementInspector] Throttling mousemove event, skipping execution.");
                return;
            }
            lastCall = now; // Update the last call timestamp
            // Call the original function with the correct `this` context and arguments.
            return fn.apply(this, args);
        };
    }

    /**
     * @class ElementInspector
     * @description Manages the interactive element inspection process on a web page.
     * This includes highlighting elements on hover, allowing users to select elements via click,
     * generating robust CSS selectors and XPaths, and communicating selected element data
     * back to the extension's popup or background script. It uses advanced locator strategies including:
     * - Shadow DOM penetration
     * - Dynamic waits
     * - Resilience scoring
     * - Fallback chains
     * - Semantic parents tracking
     * - Relative positioning
     * It also handles comprehensive cleanup.
     */
    class ElementInspector {
        constructor() {
            // Removed internal _debugMode; relying on global Logger.debug
            this._log("Creating new ElementInspector instance.");

            // Core state variables for the inspector.
            this.isActive = false; // Indicates if inspection mode is currently active (i.e., mousemove/click listeners are on).
            // A Map to store details of elements that have been clicked and 'selected' by the user.
            // Keys: CSS selectors (string), Values: Objects containing element details (selector, xpath, name, html, attributes).
            this.selectedElements = new Map();
            this.highlightedElement = null; // Stores the DOM element currently under the mouse cursor (hovered).
            this.currentPort = null; // Reserved for potential long-lived connections with the extension (not currently used).
            this.domNodeCreationTimes = new WeakMap(); // Tracks when elements were added to the DOM (for dynamic wait strategies)
            this.mutationObserver = null;

            // Flags and references for managing injected styles.
            this.highlightStyleAdded = false; // Tracks if the custom <style> element has been appended to <head>.
            this.highlightStyleElement = null; // Reference to the actual <style> DOM element for later removal.

            // Bind methods that will be used as event listeners to ensure 'this' context is correct.
            // `handleMouseMove` is throttled to improve performance for frequent mouse events.
            this.handleMouseMove = throttle(this.handleMouseMove.bind(this), 50); // Throttle to max 20 calls/sec
            this.handleElementClick = this.handleElementClick.bind(this);
            this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);
            // Bind newly added methods
            this.getPlaywrightLocator = this.getPlaywrightLocator.bind(this);
            this.getSeleniumLocator = this.getSeleniumLocator.bind(this);
            // Binding for the `beforeunload` event, crucial for cleanup when the page is closed/navigated away.
            this.boundHandleUnload = this.handlePageUnload.bind(this);

            this._log("ElementInspector instance created with bound methods.");
        }

        /**
         * @method _log
         * @private
         * @description Centralized logging function. Prints messages to the console
         * only if `_debugMode` is true. This provides a single point of control for all logging.
         * @param {string} message - The main message to log.
         * @param {*} [data] - Optional, additional data (object, array, etc.) to log alongside the message.
         */
        _log(message, data) {
            // Relies on Logger.debug setting
            if (data !== undefined) {
                Logger.log(`[ElementInspector] ${message}`, data);
            } else {
                Logger.log(`[ElementInspector] ${message}`);
            }
        }

        /**
         * @method init
         * @description Initializes the ElementInspector by setting up global event listeners
         * and injecting necessary CSS styles. This method should be called once after class instantiation.
         */
        init() {
            this._log("Starting ElementInspector initialization...");

            // Add custom CSS styles for element highlighting if they haven't been added yet.
            if (!this.highlightStyleAdded) {
                this._log("Adding highlight styles to document head.");
                this.addHighlightStyles();
                this.highlightStyleAdded = true; // Mark as added to prevent re-addition
            }

            // Set up the listener for messages from the browser extension's background script or popup.
            // This is how the extension commands the content script (e.g., to start/stop inspection).
            chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
            this._log("Runtime message listener added.");

            // Add a listener for the `beforeunload` event to ensure proper cleanup
            // when the user navigates away from the page or closes the tab.
            window.addEventListener('beforeunload', this.boundHandleUnload);
            this._log("Beforeunload listener added for cleanup.");

            // Also add a listener for `chrome.runtime.onSuspend` for more robust cleanup in certain
            // extension lifecycle scenarios (e.g., when the extension's event page goes idle).
            // This ensures resources are released even if the content script isn't fully unloaded.
            if (chrome.runtime?.onSuspend) {
                chrome.runtime.onSuspend.addListener(() => {
                    this._log("Extension suspending, initiating cleanup via onSuspend.");
                    this.clearAllStates(); // Perform a full cleanup
                    // Potentially nullify the global instance to prevent re-initialization issues
                    // if the content script environment persists in some edge cases.
                    window.elementInspector = null;
                });
                this._log("chrome.runtime.onSuspend listener added.");
            }

            this._log("ElementInspector initialization complete.");
        }

        /**
         * @method addHighlightStyles
         * @description Dynamically creates a `<style>` element and appends it to the document's `<head>`.
         * This injects the CSS rules required for element highlighting and tooltips.
         * Includes error handling for robustness.
         */
        addHighlightStyles() {
            this._log("Attempting to add highlight styles.");

            // Prevent re-adding styles if a reference to the style element already exists.
            if (this.highlightStyleElement) {
                this._log("Styles already added, skipping re-addition.");
                return;
            }

            try {
                this.highlightStyleElement = document.createElement('style');
                this.highlightStyleElement.textContent = `
                    /* Styles for the temporary highlight when hovering over an element. */
                    .element-highlight {
                        outline: 2px solid #f59e0b !important; /* Vibrant orange outline for hover */
                        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3) !important; /* Soft, transparent orange shadow */
                        position: relative; /* Essential for correct tooltip positioning */
                        z-index: 9999; /* Ensures the hover highlight is above most page content */
                    }
                    /* Styles for the tooltip that displays the element's CSS selector. */
                    .element-tooltip {
                        position: absolute;
                        background: #1e293b; /* Dark background for readability */
                        color: white; /* White text color */
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        z-index: 10000; /* Ensures the tooltip is always on top */
                        pointer-events: none; /* Allows mouse events to pass through the tooltip to the element beneath */
                        transform: translateY(-100%); /* Positions the tooltip above the element it describes */
                        white-space: nowrap; /* Prevents the selector text from wrapping */
                        top: 0; /* Aligns to the top edge of the highlighted element */
                        left: 0;
                    }
                    /* Styles for elements that have been explicitly selected (clicked) by the user. */
                    .element-selected-highlight {
                        outline: 2px dashed #10B981 !important; /* Green dashed outline for selected elements */
                        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3) !important; /* Semi-transparent green shadow */
                        position: relative;
                        z-index: 9998; /* Slightly below the hover highlight, but still prominent */
                    }
                `;
                document.head.appendChild(this.highlightStyleElement);
                this._log("Highlight styles successfully added to document head.");
            } catch (error) {
                this._log("ERROR: Failed to add highlight styles:", error);
                // Reset flag if insertion failed, so a subsequent attempt might work
                this.highlightStyleAdded = false;
                this.highlightStyleElement = null;
            }
        }

        /**
         * @method handleRuntimeMessage
         * @description Processes messages received from other parts of the Chrome extension (e.g., popup or background script).
         * This acts as the primary control mechanism for the Element Inspector's state.
         * @param {object} request - The message object containing the `action` to perform.
         * @param {object} sender - An object containing information about the script context that sent the message.
         * @param {function} sendResponse - A function to call to send a response back to the message sender.
         * @returns {boolean} - Returns `true` to indicate that the `sendResponse` callback will be called asynchronously.
         */
        handleRuntimeMessage(request, sender, sendResponse) {
            this._log(`Received runtime message action: ${request.action}`, request);

            try {
                switch (request.action) {
                    case "startInspect":
                        this._log("Received request to start inspection.");
                        this.startInspection();
                        sendResponse({ status: "started" }); // Acknowledge message receipt and action taken
                        break;
                    case "stopInspect":
                        this._log("Received request to stop inspection.");
                        this.stopInspection();
                        sendResponse({ status: "stopped" });
                        break;
                    case "resetInspect":
                        this._log("Received request to reset inspection (clear selections).");
                        this.resetInspection();
                        sendResponse({ status: "reset" });
                        break;
                    case "removeHighlight":
                        this._log(`Received request to remove highlight for selector: ${request.selector}`);
                        this.removeSpecificHighlight(request.selector);
                        sendResponse({ status: "removed" });
                        break;
                    case "clearAll":
                        this._log("Received request to clear all inspector states.");
                        this.clearAllStates();
                        sendResponse({ status: "cleared" });
                        break;
                    default:
                        this._log("WARN: Unknown action received in runtime message:", request.action);
                        sendResponse({ status: "unknown action" });
                        break;
                }
            } catch (error) {
                this._log("ERROR: Error handling runtime message:", error);
                // Send an error response back to the sender
                sendResponse({ status: "error", message: error.message, action: request.action });
            }

            return true; // Important: Indicates that sendResponse will be called asynchronously.
        }

        /**
         * @method clearAllStates
         * @description Performs a comprehensive cleanup of the inspector's state,
         * removing all active highlights, tooltips, event listeners, and internal data.
         * This should be called when the inspector is no longer needed or the page is unloading.
         */
        clearAllStates() {
            this._log("Initiating full cleanup: clearing all states.");

            // Deactivate inspection mode.
            this.isActive = false;
            this.stopMutationObserver();
            this._log("Inspection deactivated.");

            // Clear all selected elements from the internal Map.
            const selectedCount = this.selectedElements.size;
            this.selectedElements.clear();
            this._log(`Cleared ${selectedCount} selected elements from internal storage.`);

            // Remove all active highlight classes from any elements on the page.
            document.querySelectorAll('.element-highlight, .element-selected-highlight').forEach(el => {
                el.classList.remove('element-highlight', 'element-selected-highlight');
            });
            this._log("Removed all highlight classes from DOM elements.");

            // Remove all tooltips that might be present on the page.
            document.querySelectorAll('.element-tooltip').forEach(tooltip => {
                tooltip.remove();
            });
            this._log("Removed all tooltips from DOM.");

            // Reset the body's cursor style to default.
            document.body.style.cursor = '';
            this._log("Cursor style reset.");

            // Crucially, remove all event listeners to prevent memory leaks.
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('click', this.handleElementClick, true); // `true` matches addEventListener's capture phase
            window.removeEventListener('beforeunload', this.boundHandleUnload); // Remove the unload listener itself
            this._log("All DOM event listeners removed.");

            // Remove the dynamically injected style element from the document head.
            if (this.highlightStyleElement && this.highlightStyleElement.parentNode) {
                this.highlightStyleElement.parentNode.removeChild(this.highlightStyleElement);
                this.highlightStyleElement = null; // Clear the reference
                this.highlightStyleAdded = false; // Reset the flag
                this._log("Injected style element removed from document head.");
            } else {
                this._log("No style element to remove or already removed.");
            }

            this._log("All ElementInspector states cleared successfully.");
        }

        /**
         * @method startInspection
         * @description Activates the element inspection mode. This enables the mousemove
         * and click event listeners, and changes the cursor to a crosshair.
         */
        startInspection() {
            // If inspection is already active, do nothing to prevent re-adding listeners.
            if (this.isActive) {
                this._log("Inspection already active, skipping start request.");
                return;
            }

            this._log("Activating inspection mode.");
            this.isActive = true; // Set state to active

            // Add event listeners for dynamic highlighting on hover and selecting elements on click.
            document.addEventListener('mousemove', this.handleMouseMove);
            // Attach `click` listener in the capture phase (`true`) to intercept clicks before
            // they reach their target elements, preventing default actions (e.g., link navigation).
            document.addEventListener('click', this.handleElementClick, true);
            document.body.style.cursor = 'crosshair'; // Visual cue for inspection mode

            this.startMutationObserver();

            this._log("Inspection mode activated with event listeners and cursor change.");
        }

        /**
         * @method stopInspection
         * @description Deactivates the element inspection mode. Removes the mousemove
         * and click event listeners, and resets the cursor. It specifically handles
         * current hover highlights but preserves selected elements' highlights.
         */
        stopInspection() {
            // If inspection is not active, do nothing.
            if (!this.isActive) {
                this._log("Inspection not active, skipping stop request.");
                return;
            }

            this._log("Deactivating inspection mode.");
            this.isActive = false; // Set state to inactive

            // Remove the previously added event listeners.
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('click', this.handleElementClick, true);
            document.body.style.cursor = ''; // Reset cursor to default

            this.stopMutationObserver();

            // If an element is currently highlighted (hovered) and it's NOT a selected element,
            // remove its hover highlight and tooltip. This ensures selected elements remain highlighted.
            if (this.highlightedElement && !this.selectedElements.has(this.getElementSelector(this.highlightedElement))) {
                this._log("Removing hover highlight upon stopping inspection.");
                this.removeHighlight();
            } else if (this.highlightedElement) {
                this._log("Currently hovered element is selected; preserving its highlight.");
                // Clear the hovered element reference, but keep its selected highlight.
                this.highlightedElement = null;
            }
            // If no element was highlighted, no action needed.

            this._log("Inspection mode deactivated.");
        }

        /**
         * @method resetInspection
         * @description Clears all currently selected elements and their associated highlights
         * from the page and internal storage. The inspection mode (hovering) itself might remain active.
         */
        resetInspection() {
            this._log("Resetting inspection state: clearing selected elements.");

            const selectedCount = this.selectedElements.size;
            // Iterate over all currently selected elements and remove their specific highlight class from the DOM.
            this.selectedElements.forEach((details, selector) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.classList.remove('element-selected-highlight');
                    // Also ensure any tooltip for a selected element is removed if it's not the hovered element
                    this.removeTooltip(element);
                }
            });

            this.selectedElements.clear(); // Clear the internal Map of selected elements.
            this.removeHighlight(); // Ensure any current hover highlight is also removed if active.

            this._log(`Reset complete: cleared ${selectedCount} selected elements.`);
            // Notify the extension's popup/background script that the selection has been cleared.
            chrome.runtime.sendMessage({ action: "selectionCleared" });
        }

        /**
         * @method startMutationObserver
         * @description Starts observing the DOM for added nodes to track their creation time.
         * This helps determine if an element is dynamically loaded (for generated wait strategies).
         */
        startMutationObserver() {
            if (this.mutationObserver) return;
            this.mutationObserver = new MutationObserver((mutations) => {
                const now = Date.now();
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.domNodeCreationTimes.set(node, now);
                            }
                        });
                    }
                }
            });
            this.mutationObserver.observe(document.body, { childList: true, subtree: true });
            this._log("Mutation observer started for dynamic element tracking.");
        }

        /**
         * @method stopMutationObserver
         * @description Stops the mutation observer.
         */
        stopMutationObserver() {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
                this._log("Mutation observer stopped.");
            }
        }

        /**
         * @method handleMouseMove
         * @description Event handler for `mousemove` events. This method is throttled.
         * It updates the temporary hover highlight based on the element currently under the cursor.
         * @param {MouseEvent} e - The mouse event object.
         */
        handleMouseMove(e) {
            if (!this.isActive) {
                this._log("Mouse move event ignored: inspection is inactive.");
                return;
            }

            // Use composedPath() to penetrate Shadow DOM and get the real target
            const path = e.composedPath();
            const element = path && path.length > 0 ? path[0] : e.target;

            // Optimize: If the mouse is still over the same element, no need to update highlight.
            if (element === this.highlightedElement) {
                // This message will appear less often due to throttling
                this._log("Mouse still over the same element, skipping highlight update.");
                return;
            }

            this._log(`Mouse moved to new element: ${element.tagName}.`);
            // Remove the highlight from the previously hovered element.
            this.removeHighlight();
            // Apply the hover highlight to the new element.
            this.highlightElement(element);
        }

        /**
         * @method highlightElement
         * @description Applies either a temporary hover highlight or a permanent selected highlight
         * to the given DOM element, and adds/updates its associated tooltip.
         * @param {HTMLElement} element - The DOM element to highlight.
         */
        highlightElement(element) {
            const selector = this.getElementSelector(element);
            this._log(`Attempting to highlight element: ${selector}.`);

            // Always remove both highlight classes first to ensure correct state.
            element.classList.remove('element-highlight', 'element-selected-highlight');

            if (this.selectedElements.has(selector)) {
                // If the element is already selected, apply the 'selected' highlight.
                this._log(`Element '${selector}' is already selected; applying selected highlight.`);
                element.classList.add('element-selected-highlight');
                this.removeTooltip(element); // Selected elements don't need hover tooltips.
            } else {
                // Otherwise, apply the temporary 'hover' highlight and its tooltip.
                this._log(`Element '${selector}' not selected; applying regular hover highlight.`);
                element.classList.add('element-highlight');
                this.addTooltip(element);
            }
            // Update the reference to the currently highlighted element.
            this.highlightedElement = element;
            this._log(`Element highlighted successfully: ${selector}.`);
        }

        /**
         * @method removeHighlight
         * @description Removes the temporary hover highlight and its tooltip from the
         * `highlightedElement` (the element currently under the cursor), if it exists.
         * This method does *not* remove the `element-selected-highlight` class.
         */
        removeHighlight() {
            if (!this.highlightedElement) {
                this._log("No element currently hovered to unhighlight.");
                return;
            }

            const selector = this.getElementSelector(this.highlightedElement);
            this._log(`Removing hover highlight from: ${selector}.`);

            // Only remove the `element-highlight` class if the element is not also selected.
            // This prevents a selected element from losing its highlight when the mouse moves off it.
            if (!this.selectedElements.has(selector)) {
                this.highlightedElement.classList.remove('element-highlight');
                this.removeTooltip(this.highlightedElement); // Remove tooltip only if it's a hover highlight
            } else {
                this._log(`Element '${selector}' is selected, preserving selected highlight.`);
            }

            this.highlightedElement = null; // Clear the reference to the hovered element.
            this._log(`Hover highlight removed from: ${selector}.`);
        }

        /**
         * @method addTooltip
         * @description Creates a small informational tooltip displaying the element's CSS selector
         * and appends it to the element itself.
         * @param {HTMLElement} element - The DOM element to which the tooltip should be attached.
         */
        addTooltip(element) {
            // Prevent adding multiple tooltips to the same element.
            if (element.querySelector('.element-tooltip')) {
                this._log("Tooltip already exists on element, skipping addition.");
                return;
            }

            const tooltip = document.createElement('div');
            tooltip.className = 'element-tooltip';
            tooltip.textContent = this.getElementSelector(element); // Display the generated CSS selector
            element.appendChild(tooltip); // Append the tooltip directly into the element.
            this._log(`Tooltip added to element: ${tooltip.textContent}.`);
        }

        /**
         * @method removeTooltip
         * @description Removes the tooltip element from a given DOM element, if present.
         * @param {HTMLElement} element - The element from which the tooltip should be removed.
         */
        removeTooltip(element) {
            const tooltip = element.querySelector('.element-tooltip');
            if (!tooltip) {
                this._log("No tooltip found on element to remove.");
                return;
            }

            this._log(`Removing tooltip: ${tooltip.textContent}.`);
            tooltip.remove(); // Removes the tooltip DOM element.
        }

        /**
         * @method handleElementClick
         * @description Event handler for `click` events. Toggles the selection state of the clicked element:
         * if selected, it deselects; if not selected, it selects. It also updates highlights and
         * communicates the new selection state to the extension.
         * This method is attached in the capture phase to ensure it runs before other click handlers.
         * @param {MouseEvent} e - The mouse event object.
         */
        handleElementClick(e) {
            if (!this.isActive) {
                this._log("Click event ignored: inspection is inactive.");
                return;
            }

            this._log("Handling element click event.");
            e.preventDefault(); // Prevent default browser actions (e.g., navigating links, submitting forms).
            e.stopPropagation(); // Stop event bubbling up to parent elements.
            e.stopImmediatePropagation(); // Further prevents other listeners on the same element from firing.

            // Use composedPath() to penetrate Shadow DOM
            const path = e.composedPath();
            const element = path && path.length > 0 ? path[0] : e.target;
            const selector = this.getElementSelector(element);
            this._log(`Clicked element selector: ${selector}.`);

            if (this.selectedElements.has(selector)) {
                // Element is already selected, so deselect it.
                this._log(`Element '${selector}' is already selected; deselecting.`);
                this.selectedElements.delete(selector); // Remove from internal selection Map.
                element.classList.remove('element-selected-highlight'); // Remove the selected highlight.

                // If this element was also the one currently highlighted by hover, clear its hover state.
                if (this.highlightedElement === element) {
                    element.classList.remove('element-highlight');
                    this.removeTooltip(element);
                    this.highlightedElement = null;
                }
                this._log(`Element '${selector}' unselected.`);
            } else {
                // Element is not selected, so select it.
                this._log(`Selecting new element: ${selector}.`);
                // Check if element is dynamic (created within the last 2 seconds)
                let isDynamic = false;
                if (this.domNodeCreationTimes.has(element)) {
                    const creationTime = this.domNodeCreationTimes.get(element);
                    if (Date.now() - creationTime < 2000) {
                        isDynamic = true;
                    }
                }

                // Also classify as dynamic if the ID or class looks auto-generated (lots of digits)
                if (!isDynamic) {
                    const id = element.id || "";
                    const className = typeof element.className === 'string' ? element.className : "";
                    if (/\d{4,}/.test(id) || /\d{4,}/.test(className)) {
                        isDynamic = true;
                    }
                }

                this.selectedElements.set(selector, {
                    selector: selector,
                    xpath: this.getElementXPath(element),
                    name: this.getElementName(element),
                    html: element.outerHTML,
                    attributes: this.getElementAttributes(element),
                    playwrightLocator: this.getPlaywrightLocator(element, isDynamic),
                    seleniumLocator: this.getSeleniumLocator(element, isDynamic),
                    isDynamic: isDynamic // Track this flag explicitly
                });

                element.classList.add('element-selected-highlight'); // Apply the selected highlight.
                // Ensure no hover highlight or tooltip remains on a newly selected element.
                element.classList.remove('element-highlight');
                this.removeTooltip(element);
                this.highlightedElement = null; // Clear hovered element reference as it's now selected.

                this._log(`New element selected: ${selector}.`);
            }

            // Always send the updated list of selected elements to the extension after a click.
            this.sendSelectedElementsToExtension();
        }

        /**
         * @method getElementAttributes
         * @description Extracts a subset of common and useful attributes from a given DOM element.
         * This provides more context about the element to the extension.
         * @param {HTMLElement} element - The DOM element from which to extract attributes.
         * @returns {object} - An object where keys are attribute names and values are their corresponding string values.
         */
        getElementAttributes(element) {
            this._log("Collecting element attributes.");
            const attrs = {};
            // Define a list of attributes deemed most useful for identification/context.
            const commonAttributes = ['id', 'class', 'name', 'data-testid', 'aria-label', 'role', 'type', 'value', 'placeholder', 'alt', 'src', 'href'];
            commonAttributes.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    attrs[attr] = element.getAttribute(attr);
                    this._log(`Found attribute: ${attr} = '${attrs[attr]}'`);
                }
            });
            this._log("Finished collecting attributes.");
            return attrs;
        }

        /**
         * @method sendSelectedElementsToExtension
         * @description Converts the internal Map of selected element details into a plain array
         * and sends it as a message to the extension's background script or popup.
         */
        sendSelectedElementsToExtension() {
            this._log("Preparing to send selected elements data to extension.");
            // Convert Map values (the element detail objects) into an array.
            const elements = Array.from(this.selectedElements.values());

            this._log(`Sending ${elements.length} selected element(s) to extension.`, elements);
            chrome.runtime.sendMessage({
                action: "updateSelectedElements",
                elements: elements
            });
            this._log("Selected elements data sent to extension.");
        }

        /**
         * @method removeSpecificHighlight
         * @description Removes the highlight and selection state for a single element identified by its CSS selector.
         * This is typically used when the extension's UI allows the user to deselect an element.
         * @param {string} selector - The CSS selector of the element to be de-highlighted and removed from selection.
         */
        removeSpecificHighlight(selector) {
            this._log(`Attempting to remove specific highlight for selector: ${selector}.`);
            const element = document.querySelector(selector);

            if (!element) {
                this._log(`Element not found in DOM with selector '${selector}', cannot remove highlight.`);
                return;
            }

            this._log(`Found element '${selector}' to remove highlight from.`);
            // Remove all relevant highlight classes.
            element.classList.remove('element-highlight', 'element-selected-highlight');
            this.removeTooltip(element); // Ensure tooltip is removed.

            // If the element being removed was the one currently hovered, clear that reference.
            if (this.highlightedElement === element) {
                this._log("Removed element was the currently hovered element; clearing reference.");
                this.highlightedElement = null;
            }

            this.selectedElements.delete(selector); // Remove from the internal selection Map.
            this._log(`Element '${selector}' removed from internal selection.`);

            // Update the extension with the modified list of selected elements.
            this.sendSelectedElementsToExtension();
        }

        /**
         * @method getElementSelector
         * @description Generates a robust and unique CSS selector for a given DOM element.
         * It attempts various strategies in order of reliability: ID, unique classes, common attributes,
         * and finally a path-based approach using tag names and `nth-of-type` up the DOM tree.
         * @param {HTMLElement} element - The DOM element for which to generate a selector.
         * @returns {string} - The most specific and unique CSS selector found for the element.
         */
        getElementSelector(element) {
            this._log(`Generating selector for element: ${element.tagName.toLowerCase()}.`);

            // 1. Prioritize unique ID.
            if (element.id) {
                const selector = `#${element.id}`;
                if (this.isUniqueSelector(selector, element)) {
                    this._log(`Generated selector (ID): ${selector}.`);
                    return selector;
                }
            }

            // 2. Try unique classes. Iterate through individual classes first, then try combined.
            if (element.className && typeof element.className === 'string' && element.className.trim() !== '') {
                const classNames = element.className.trim().split(/\s+/).filter(Boolean);
                // Try each class individually for uniqueness
                for (const cls of classNames) {
                    const selector = `.${cls}`;
                    if (this.isUniqueSelector(selector, element)) {
                        this._log(`Generated selector (Single Class): ${selector}.`);
                        return selector;
                    }
                }
                // If no single class is unique, try the combination of all classes
                if (classNames.length > 0) {
                    const combinedClassSelector = `.${classNames.join('.')}`;
                    if (this.isUniqueSelector(combinedClassSelector, element)) {
                        this._log(`Generated selector (Combined Classes): ${combinedClassSelector}.`);
                        return combinedClassSelector;
                    }
                }
            }

            // 3. Try common and useful attributes like 'name', 'data-testid', 'role', 'type', 'aria-label'.
            // These are often more stable than general classes.
            let selector = element.tagName.toLowerCase();
            const commonAttributes = ['name', 'data-testid', 'role', 'type', 'aria-label', 'value', 'placeholder'];
            for (const attr of commonAttributes) {
                const attrValue = element.getAttribute(attr);
                if (attrValue) {
                    const attrSelector = `${selector}[${attr}="${attrValue}"]`;
                    if (this.isUniqueSelector(attrSelector, element)) {
                        this._log(`Generated selector (Attribute): ${attrSelector}.`);
                        return attrSelector;
                    }
                }
            }

            // 4. Fallback to generating a path-based selector using tag names and nth-of-type.
            // This builds a selector relative to its parent, then potentially its grandparent, etc.,
            // until a unique path is formed or a reasonable depth limit is reached.
            let currentSelector = element.tagName.toLowerCase();
            let index = 1; // Start counting from 1 for :nth-of-type
            let sibling = element.previousElementSibling;
            // Count previous siblings of the same tag type to determine :nth-of-type index.
            while (sibling) {
                if (sibling.tagName.toLowerCase() === element.tagName.toLowerCase()) {
                    index++;
                }
                sibling = sibling.previousElementSibling;
            }
            // Append :nth-of-type if it's not the first child of its type OR if the tag name alone is not unique.
            if (index > 1 || !this.isUniqueSelector(currentSelector, element)) {
                currentSelector += `:nth-of-type(${index})`;
            }

            let path = [currentSelector];
            let currentElement = element;
            const maxDepth = 5; // Limit traversal depth to prevent overly long selectors.
            while (currentElement.parentElement && path.length < maxDepth) {
                currentElement = currentElement.parentElement;
                let parentTag = currentElement.tagName.toLowerCase();
                let parentIndex = 1;
                let parentSibling = currentElement.previousElementSibling;
                // Count previous siblings of the parent's same tag type.
                while (parentSibling) {
                    if (parentSibling.tagName.toLowerCase() === currentElement.tagName.toLowerCase()) {
                        parentIndex++;
                    }
                    parentSibling = parentSibling.previousElementSibling;
                }
                // Add :nth-of-type to the parent if needed.
                if (parentIndex > 1 || !this.isUniqueSelector(parentTag, currentElement)) {
                    parentTag += `:nth-of-type(${parentIndex})`;
                }
                path.unshift(parentTag); // Prepend parent selector to the path.

                // Test if the current compounded selector is unique.
                const testSelector = path.join(' > ');
                if (this.isUniqueSelector(testSelector, element)) {
                    this._log(`Generated selector (Ancestry Path): ${testSelector}.`);
                    return testSelector;
                }
            }

            // Final fallback: the most specific selector generated so far, even if not globally unique.
            const finalSelector = path.join(' > ');
            this._log(`Generated selector (Final Fallback): ${finalSelector}.`);
            return finalSelector;
        }

        /**
         * @method isUniqueSelector
         * @private
         * @description Checks if a given CSS selector uniquely identifies the specified DOM element
         * within the current document.
         * @param {string} selector - The CSS selector string to test.
         * @param {HTMLElement} element - The specific DOM element that the selector is expected to match uniquely.
         * @returns {boolean} - `true` if the selector matches only one element and that element is the target element; `false` otherwise.
         */
        isUniqueSelector(selector, element) {
            try {
                const elements = document.querySelectorAll(selector);
                const isUnique = elements.length === 1 && elements[0] === element;
                this._log(`Selector uniqueness check for '${selector}': Result=${isUnique}.`);
                return isUnique;
            } catch (e) {
                // Catches errors for invalid or malformed selectors.
                this._log(`ERROR: Error checking selector uniqueness for '${selector}':`, e);
                return false;
            }
        }

        /**
         * @method getElementXPath
         * @description Generates an XPath expression for a given DOM element.
         * Prioritizes ID for direct access, then falls back to a path-based XPath.
         * @param {HTMLElement} element - The DOM element for which to generate an XPath.
         * @returns {string|null} - The generated XPath string, or `null` if no XPath can be generated.
         */
        getElementXPath(element) {
            this._log("Generating XPath for element.");

            // If the element has a unique ID, prefer a direct XPath using the ID.
            if (element.id) {
                const xpath = `//*[@id="${element.id}"]`;
                this._log(`Generated XPath (ID): ${xpath}.`);
                return xpath;
            }

            const paths = [];
            // Traverse up the DOM tree from the element to the document root.
            for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
                let index = 0;
                // Count previous siblings of the same tag name to determine the XPath index (1-based).
                for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
                        index++;
                    }
                }
                const tagName = element.tagName.toLowerCase();
                // Append `[index + 1]` for XPath's 1-based indexing if there are preceding siblings of the same type.
                const pathIndex = (index ? `[${index + 1}]` : '');
                // Prepend the current element's tag and index to the paths array, building the XPath in reverse.
                paths.unshift(tagName + pathIndex);
            }

            // Join the collected paths with '/' to form the full XPath.
            const xpath = paths.length ? '/' + paths.join('/') : null;
            this._log(`Generated XPath: ${xpath}.`);
            return xpath;
        }

        /**
         * @method calculateResilienceScore
         * @description Evaluates and assigns a resilience score (0-100) to a locator strategy
         * to determine its reliability and stability. This scoring system drives the fallback chain generation.
         * @param {string} type - The type of locator.
         * @param {string} value - The value.
         * @returns {number} Score from 0 to 100.
         */
        calculateResilienceScore(type, value) {
            if (type === 'testid') return 100;
            if (type === 'role') return 90;
            if (type === 'placeholder') return 80;
            if (type === 'text') return 60;
            if (type === 'id') {
                if (/\\d{4,}/.test(value)) return 10; // Dynamic ID
                return 70;
            }
            if (type === 'name') return 65;
            if (type === 'class') {
                if (/\\d{4,}/.test(value)) return 10; // Dynamic Class
                return 40;
            }
            if (type === 'css') {
                if (value.includes(':nth-of-type') || value.split('>').length > 3) return 15; // Fragile path
                return 30; // Better CSS
            }
            return 0;
        }

        /**
         * @method getPlaywrightLocator
         * @description Generates a highly resilient Playwright semantic locator based on modern testing standards.
         * Integrates advanced strategies including Shadow DOM penetration (via composedPath during selection), 
         * dynamic waits tracking, semantic parents tracking, relative positioning, and fallback chains (.or()).
         * Prioritizes test IDs, ARIA roles, placeholders, and visible text.
         * @param {HTMLElement} element - The DOM element.
         * @param {boolean} isDynamic - Whether the element was dynamically loaded.
         * @returns {string} - The exact string for a Playwright locator.
         */
        getPlaywrightLocator(element, isDynamic = false) {
            this._log("Generating Playwright semantic fallback locator.");
            const locators = [];

            // Helper to get semantic parent context
            const getSemanticParent = (el) => {
                let current = el.parentElement;
                let depth = 0;
                while (current && depth < 4) {
                    const tag = current.tagName.toLowerCase();
                    if (['form', 'main', 'section', 'article', 'tr'].includes(tag) || current.getAttribute('data-testid')) {
                        if (current.getAttribute('data-testid')) return `getByTestId('${current.getAttribute('data-testid')}')`;
                        if (current.getAttribute('aria-label')) return `getByRole('region', { name: '${current.getAttribute('aria-label').replace(/'/g, "\\'")}' })`;
                        return `locator('${tag}')`;
                    }
                    current = current.parentElement;
                    depth++;
                }
                return null;
            };

            // Helper to get relative locator (sibling label)
            const getRelativeContext = (el) => {
                if (el.tagName.toLowerCase() !== 'input') return null;
                const prev = el.previousElementSibling;
                if (prev && prev.tagName.toLowerCase() === 'label' && prev.innerText) {
                    return `getByLabel('${prev.innerText.trim().replace(/'/g, "\\'")}')`;
                }
                return null;
            };

            const semanticParent = getSemanticParent(element);
            const relativeContext = getRelativeContext(element);
            const prefix = semanticParent ? `${semanticParent}.` : '';

            // 1. data-testid
            if (element.getAttribute('data-testid')) {
                locators.push({
                    str: `${prefix}getByTestId('${element.getAttribute('data-testid')}')`,
                    score: this.calculateResilienceScore('testid', element.getAttribute('data-testid'))
                });
            }

            // 2. Relative or Placeholder text
            if (relativeContext) {
                locators.push({
                    str: `${prefix}${relativeContext}`,
                    score: 85 // High score for associated labels
                });
            } else if (element.getAttribute('placeholder')) {
                locators.push({
                    str: `${prefix}getByPlaceholder('${element.getAttribute('placeholder')}')`,
                    score: this.calculateResilienceScore('placeholder', element.getAttribute('placeholder'))
                });
            }

            // 3. ARIA Role & Name
            let role = element.getAttribute('role');
            if (!role) {
                const tag = element.tagName.toLowerCase();
                const type = element.getAttribute('type');
                if (tag === 'button' || (tag === 'input' && (type === 'button' || type === 'submit' || type === 'reset'))) role = 'button';
                else if (tag === 'a' && element.hasAttribute('href')) role = 'link';
                else if (tag === 'input' && type === 'checkbox') role = 'checkbox';
                else if (tag === 'input' && type === 'radio') role = 'radio';
                else if (tag === 'select') role = 'combobox';
                else if (tag === 'input') role = 'textbox';
                else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) role = 'heading';
            }

            if (role) {
                let name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('alt');
                if (!name && element.innerText && element.innerText.trim().length > 0) {
                    name = element.innerText.trim().split('\n')[0].substring(0, 50);
                }
                if (name) {
                    const escapedName = name.replace(/'/g, "\\'");
                    locators.push({
                        str: `${prefix}getByRole('${role}', { name: '${escapedName}' })`,
                        score: this.calculateResilienceScore('role', role)
                    });
                }
            }

            // 4. Visible Text (if no child nodes or explicitly distinct)
            if (element.innerText && element.innerText.trim().length > 0 && element.children.length === 0) {
                const text = element.innerText.trim().split('\n')[0].substring(0, 50);
                const escapedText = text.replace(/'/g, "\\'");
                locators.push({
                    str: `${prefix}getByText('${escapedText}')`,
                    score: this.calculateResilienceScore('text', text)
                });
            }

            // 5. Fallback CSS selector
            const cssSelector = this.getElementSelector(element);
            const escapedCss = cssSelector.replace(/'/g, "\\'");
            locators.push({
                str: `locator('${escapedCss}')`,
                score: this.calculateResilienceScore('css', cssSelector)
            });

            // Sort by score descending and take top 3
            locators.sort((a, b) => b.score - a.score);
            const topLocators = locators.slice(0, 3).map(l => l.str);

            let resultLocator = topLocators[0];
            if (topLocators.length > 1) {
                resultLocator = topLocators[0];
                for (let i = 1; i < topLocators.length; i++) {
                    resultLocator += `.or(page.${topLocators[i]})`;
                }
            }

            if (isDynamic) {
                return `// DYNAMIC ELEMENT WAITER\nawait page.waitForSelector('${escapedCss}', { state: 'visible', timeout: 5000 });\nawait page.${resultLocator}`;
            }

            return `page.${resultLocator}`;
        }

        /**
         * @method getSeleniumLocator
         * @description Generates an explicit Selenium By locator string utilizing advanced 
         * generation techniques such as Shadow DOM penetration, dynamic waits (ExpectedConditions), 
         * resilience scoring, and fallback chains (try/catch blocks).
         * @param {HTMLElement} element - The DOM element.
         * @param {boolean} isDynamic - Whether the element was dynamically loaded.
         * @returns {string} - The exact Selenium code snippet.
         */
        getSeleniumLocator(element, isDynamic = false) {
            this._log("Generating explicit Selenium locator snippet.");

            const escapeCssStr = (str) => {
                if (!str) return '';
                return str.replace(/(["'\\])/g, '\\$1');
            };

            const locators = [];

            if (element.id && this.isUniqueSelector(`#${escapeCssStr(element.id)}`, element)) {
                locators.push({
                    str: `By.id("${element.id}")`,
                    score: this.calculateResilienceScore('id', element.id)
                });
            }

            if (element.getAttribute('name')) {
                const nameValue = element.getAttribute('name');
                const selector = `${element.tagName.toLowerCase()}[name="${escapeCssStr(nameValue)}"]`;
                if (this.isUniqueSelector(selector, element)) {
                    locators.push({
                        str: `By.name("${nameValue}")`,
                        score: this.calculateResilienceScore('name', nameValue)
                    });
                }
            }

            const cssSelector = this.getElementSelector(element);
            const escapedCss = cssSelector.replace(/"/g, '\\"');
            locators.push({
                str: `By.cssSelector("${escapedCss}")`,
                score: this.calculateResilienceScore('css', cssSelector)
            });

            // Sort and take top 2 for try/catch
            locators.sort((a, b) => b.score - a.score);
            const topLocators = locators.slice(0, 2).map(l => l.str);

            let waitStr = "";
            if (isDynamic) {
                waitStr = `WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));\nwait.until(ExpectedConditions.visibilityOfElementLocated(${topLocators[0]}));\n`;
            }

            if (topLocators.length === 1) {
                return `${waitStr}driver.findElement(${topLocators[0]})`;
            } else {
                return `${waitStr}WebElement element;\ntry {\n    element = driver.findElement(${topLocators[0]});\n} catch (NoSuchElementException e) {\n    element = driver.findElement(${topLocators[1]});\n}`;
            }
        }

        /**
         * @method getElementName
         * @description Attempts to derive a human-readable name or label for an element.
         * It checks various attributes (`name`, `aria - label`, `data - testid`, `title`)
         * and falls back to truncated `innerText` or the element's tag name.
         * @param {HTMLElement} element - The DOM element.
         * @returns {string} - A descriptive name for the element.
         */
        getElementName(element) {
            this._log("Attempting to get element name.");

            // Prioritize specific attributes commonly used for naming/labeling.
            if (element.getAttribute('name')) {
                const name = element.getAttribute('name');
                this._log(`Using 'name' attribute: ${name}.`);
                return name;
            }
            if (element.getAttribute('aria-label')) {
                const name = element.getAttribute('aria-label');
                this._log(`Using 'aria-label' attribute: ${name}.`);
                return name;
            }
            if (element.getAttribute('data-testid')) {
                const name = element.getAttribute('data-testid');
                this._log(`Using 'data-testid' attribute: ${name}.`);
                return name;
            }

            // If innerText exists and is not just whitespace, use a truncated version.
            if (element.innerText && element.innerText.trim().length > 0) {
                const text = element.innerText.trim();
                const name = text.substring(0, 50) + (text.length > 50 ? '...' : '');
                this._log(`Using innerText(truncated to 50 chars): ${name}.`);
                return name;
            }

            // Fallback to the `title` attribute.
            if (element.title) {
                this._log(`Using 'title' attribute: ${element.title}.`);
                return element.title;
            }

            // Final fallback: the element's tag name.
            const tagName = element.tagName.toLowerCase();
            this._log(`Defaulting to tag name: ${tagName}.`);
            return tagName;
        }

        /**
         * @method handlePageUnload
         * @description This is the callback for the `beforeunload` event. It triggers
         * `clearAllStates` to ensure all resources and listeners are cleaned up
         * just before the page is unloaded, preventing memory leaks.
         */
        handlePageUnload() {
            this._log("Page is unloading via beforeunload event, initiating cleanup.");
            this.clearAllStates(); // Perform a full cleanup.
            this._log("Page unload cleanup complete.");
            // Note: The `window.removeEventListener` for `beforeunload` is handled within `clearAllStates`.
        }
    }

    // Instantiate and initialize the ElementInspector. This global instance
    // will manage all inspection-related activities on the page.
    window.elementInspector = new ElementInspector();
    window.elementInspector.init();

} else {
    // If `window.elementInspector` already exists, it means the script was already
    // executed on this page. Log a warning to prevent redundant operations.
    // Use the existing inspector's _log function if available, otherwise fallback to console.warn.
    if (window.elementInspector && typeof window.elementInspector._log === 'function') {
        window.elementInspector._log("ElementInspector is already initialized. Skipping re-initialization.");
    } else {
        console.warn("[ElementInspector] Already initialized, skipping. (Fallback console.warn)");
    }
}
