// @ts-expect-error
if (
  typeof globalThis.chrome === 'undefined' ||
  !(globalThis as any).chrome.runtime ||
  !(globalThis as any).chrome.runtime.id
) {
  // @ts-expect-error
  (globalThis as any).chrome = {
    runtime: {
      id: 'build-mock',
      getURL: (path: string) => path,
    },
  };
}

import browser from 'webextension-polyfill';
export default browser;
export const chrome = (globalThis as any).chrome;
