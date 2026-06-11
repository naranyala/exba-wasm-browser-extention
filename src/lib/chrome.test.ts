import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the global chrome object BEFORE importing the code that uses it
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    openOptionsPage: vi.fn(),
    lastError: null,
  },
  alarms: {
    create: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
  }
};

vi.stubGlobal('chrome', chromeMock);

// Now import the API
import { chromeAPI } from './chrome';

describe('chromeAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = null;
  });

  describe('storage.local', () => {
    it('should get data correctly', async () => {
      chromeMock.storage.local.get.mockImplementation((keys: any, callback: any) => {
        callback({ favoriteColor: 'blue' });
      });

      const result = await chromeAPI.storage.local.get<any>('favoriteColor');
      expect(result.favoriteColor).toBe('blue');
      expect(chromeMock.storage.local.get).toHaveBeenCalledWith('favoriteColor', expect.any(Function));
    });

    it('should set data correctly', async () => {
      chromeMock.storage.local.set.mockImplementation((data: any, callback: any) => {
        callback();
      });

      await chromeAPI.storage.local.set({ favoriteColor: 'red' });
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ favoriteColor: 'red' }, expect.any(Function));
    });
  });

  describe('runtime', () => {
    it('should send messages and resolve with response', async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message: any, callback: any) => {
        callback({ success: true });
      });

      const response = await chromeAPI.runtime.sendMessage<any>({ action: 'test' });
      expect(response.success).toBe(true);
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ action: 'test' }, expect.any(Function));
    });

    it('should reject when lastError is set', async () => {
      chromeMock.runtime.sendMessage.mockImplementation((message: any, callback: any) => {
        chromeMock.runtime.lastError = { message: 'Error occurred' } as any;
        callback(null);
      });

      await expect(chromeAPI.runtime.sendMessage({ action: 'fail' })).rejects.toEqual({ message: 'Error occurred' });
    });
  });
});
