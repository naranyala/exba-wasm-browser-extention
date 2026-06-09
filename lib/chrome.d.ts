/**
 * Promisified Chrome API wrappers
 */
export declare const chromeAPI: {
    storage: {
        get: (keys: any) => Promise<unknown>;
        set: (data: any) => Promise<unknown>;
    };
    tabs: {
        query: (queryInfo: any) => Promise<chrome.tabs.Tab[]>;
    };
    sidePanel: {
        open: (options: any) => Promise<void>;
    };
    runtime: {
        openOptionsPage: () => Promise<void>;
        getURL: (path: any) => string;
    };
};
