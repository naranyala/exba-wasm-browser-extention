// @ts-ignore
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
  // @ts-ignore
  globalThis.chrome = {
    runtime: {
      id: 'build-mock',
      getURL: (path: string) => path,
    },
  };
}

import browser from 'webextension-polyfill';
export default browser;
export const chrome = (globalThis as any).chrome;
