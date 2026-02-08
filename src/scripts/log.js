/**
 * Centralized Logger for the AI Test Case Generator Extension.
 * Use this module to control logging across the extension components.
 */

const Logger = {
    debug: false, // Set to false to disable all logs in production

    log: function (message, ...args) {
        if (this.debug) {
            console.log(`[AITG] ${message}`, ...args);
        }
    },

    info: function (message, ...args) {
        if (this.debug) {
            console.info(`[AITG INFO] ${message}`, ...args);
        }
    },

    warn: function (message, ...args) {
        if (this.debug) {
            console.warn(`[AITG WARN] ${message}`, ...args);
        }
    },

    error: function (message, ...args) {
        // Always log errors, regardless of debug mode, or make it conditional if preferred
        console.error(`[AITG ERROR] ${message}`, ...args);
    }
};

// Export for ES Module environments (e.g., API scripts, sidepanel modules)
// Attach to global scope for both module and non-module environments
if (typeof self !== 'undefined') {
    self.Logger = Logger;
} else if (typeof window !== 'undefined') {
    window.Logger = Logger;
} else if (typeof global !== 'undefined') {
    global.Logger = Logger;
}
