/**
 * A high-level, promisified wrapper for the Chrome Extension API.
 * This provides a cleaner async/await interface for common extension tasks.
 */
export const chromeAPI = {
  /**
   * Chrome Storage API wrappers
   */
  storage: {
    local: {
      get: <T>(keys: string | string[]): Promise<T> =>
        new Promise((resolve) => chrome.storage.local.get(keys, (result) => resolve(result as T))),
      set: (data: any): Promise<void> =>
        new Promise((resolve) => chrome.storage.local.set(data, () => { resolve(); })),
      remove: (keys: string | string[]): Promise<void> =>
        new Promise((resolve) => chrome.storage.local.remove(keys, () => { resolve(); })),
      clear: (): Promise<void> =>
        new Promise((resolve) => chrome.storage.local.clear(() => { resolve(); })),
    },
    sync: {
      get: <T>(keys: string | string[]): Promise<T> =>
        new Promise((resolve) => chrome.storage.sync.get(keys, (result) => resolve(result as T))),
      set: (data: any): Promise<void> =>
        new Promise((resolve) => chrome.storage.sync.set(data, () => { resolve(); })),
      remove: (keys: string | string[]): Promise<void> =>
        new Promise((resolve) => chrome.storage.sync.remove(keys, () => { resolve(); })),
      clear: (): Promise<void> =>
        new Promise((resolve) => chrome.storage.sync.clear(() => { resolve(); })),
    },
  },

  /**
   * Chrome Runtime API wrappers
   */
  runtime: {
    sendMessage: <T>(message: any): Promise<T> =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      }),
    openOptionsPage: (): void => chrome.runtime.openOptionsPage(),
    getURL: (path: string): string => chrome.runtime.getURL(path),
  },

  /**
   * Chrome Tabs API wrappers
   */
  tabs: {
    query: (queryInfo: any): Promise<chrome.tabs.Tab[]> =>
      new Promise((resolve) => chrome.tabs.query(queryInfo, resolve)),
    create: (details: any): Promise<chrome.tabs.Tab> =>
      new Promise((resolve) => chrome.tabs.create(details, resolve)),
    remove: (tabId: number): Promise<void> =>
      new Promise((resolve) => chrome.tabs.remove(tabId, resolve)),
  },

  /**
   * Chrome Alarms API wrappers
   */
  alarms: {
    create: (name: string, details: any): Promise<boolean> =>
        new Promise((resolve) => chrome.alarms.create(name, details, (wasCreated: any) => { resolve(wasCreated); })),
    get: (name: string): Promise<chrome.alarms.Alarm | undefined> =>
        new Promise((resolve) => chrome.alarms.get(name, resolve)),
    clear: (name: string): Promise<boolean> =>
        new Promise((resolve) => chrome.alarms.clear(name, (wasCleared: any) => { resolve(wasCleared); })),
  },

  /**
   * Chrome Offscreen API wrappers
   */
  offscreen: {
    createDocument: (details: any): Promise<void> =>
        new Promise((resolve) => chrome.offscreen.createDocument(details, resolve)),
    closeDocument: (): Promise<void> =>
        new Promise((resolve) => chrome.offscreen.closeDocument(resolve)),
  },

  /**
   * Chrome SidePanel API wrappers
   */
  sidePanel: {
    setOptions: (details: any): Promise<void> =>
        new Promise((resolve) => chrome.sidePanel.setOptions(details, resolve)),
    open: (options: any): Promise<void> =>
        new Promise((resolve) => chrome.sidePanel.open(options, resolve)),
  },

  /**
   * Chrome Scripting API wrappers
   */
  scripting: {
    executeScript: (details: any): Promise<any[]> =>
        new Promise((resolve) => chrome.scripting.executeScript(details, resolve)),
    insertCSS: (details: any): Promise<void> =>
        new Promise((resolve) => chrome.scripting.insertCSS(details, resolve)),
  },

  /**
   * Chrome ContextMenus API wrappers
   */
  contextMenus: {
    create: (details: any): Promise<void> =>
        new Promise((resolve) => chrome.contextMenus.create(details, resolve)),
    remove: (id: string | number): Promise<void> =>
        new Promise((resolve) => chrome.contextMenus.remove(id, resolve)),
  },

  /**
   * Chrome Notifications API wrappers
   */
  notifications: {
    create: (options: any): Promise<string> =>
        new Promise((resolve) => chrome.notifications.create(options, resolve)),
  },
};
