/**
 * Promisified Chrome API wrappers
 */
export const chromeAPI = {
    storage: {
        get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
        set: (data) => new Promise((resolve) => chrome.storage.local.set(data, resolve)),
    },
    tabs: {
        query: (queryInfo) => chrome.tabs.query(queryInfo),
    },
    sidePanel: {
        open: (options) => chrome.sidePanel.open(options),
    },
    runtime: {
        openOptionsPage: () => chrome.runtime.openOptionsPage(),
        getURL: (path) => chrome.runtime.getURL(path),
    },
};
//# sourceMappingURL=chrome.js.map