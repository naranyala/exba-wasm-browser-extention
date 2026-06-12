import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContextKey,
  createContext,
  provideContext,
  useContext,
} from './context';

// ─────────────────────────────────────────────────────────────────────────────
describe('createContext', () => {
  it('creates a ContextKey with the given default value', () => {
    const ctx = createContext<number>(42);
    expect(ctx).toBeInstanceOf(ContextKey);
    expect(ctx.defaultValue).toBe(42);
  });

  it('supports null as default', () => {
    const ctx = createContext<null | string>(null);
    expect(ctx.defaultValue).toBeNull();
  });

  it('supports complex object as default', () => {
    const def = { mode: 'dark' as const, accent: '#ff0' };
    const ctx = createContext(def);
    expect(ctx.defaultValue).toBe(def);
  });

  it('each createContext call produces a distinct key', () => {
    const a = createContext(0);
    const b = createContext(0);
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('useContext', () => {
  it('returns the default value when no provider is active', () => {
    const ctx = createContext('default-val');
    expect(useContext(ctx)).toBe('default-val');
  });

  it('returns default for a different ContextKey even if a provider is active for another', () => {
    const ctxA = createContext('A');
    const ctxB = createContext('B-default');
    const dispose = provideContext(ctxA, 'A-provided');
    expect(useContext(ctxB)).toBe('B-default');
    dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('provideContext / useContext', () => {
  it('provides and consumes a value', () => {
    const ctx = createContext<number>(0);
    const dispose = provideContext(ctx, 100);
    expect(useContext(ctx)).toBe(100);
    dispose();
  });

  it('restores the previous context value after dispose', () => {
    const ctx = createContext('outer');
    const disposeOuter = provideContext(ctx, 'inner');
    expect(useContext(ctx)).toBe('inner');
    disposeOuter();
    expect(useContext(ctx)).toBe('outer'); // default restored
  });

  it('inner provider shadows outer provider', () => {
    const ctx = createContext('default');
    const disposeOuter = provideContext(ctx, 'outer');
    const disposeInner = provideContext(ctx, 'inner');
    expect(useContext(ctx)).toBe('inner');
    disposeInner();
    expect(useContext(ctx)).toBe('outer');
    disposeOuter();
    expect(useContext(ctx)).toBe('default');
  });

  it('multiple contexts can be provided simultaneously', () => {
    const ctxA = createContext('A-default');
    const ctxB = createContext(0);
    const dA = provideContext(ctxA, 'A-value');
    const dB = provideContext(ctxB, 42);
    expect(useContext(ctxA)).toBe('A-value');
    expect(useContext(ctxB)).toBe(42);
    dA();
    dB();
  });

  it('dispose is idempotent — calling twice does not crash', () => {
    const ctx = createContext('default');
    const dispose = provideContext(ctx, 'value');
    dispose();
    expect(() => dispose()).not.toThrow();
  });

  it('null value can be provided and retrieved', () => {
    const ctx = createContext<string | null>('fallback');
    const dispose = provideContext(ctx, null);
    expect(useContext(ctx)).toBeNull();
    dispose();
  });

  it('deeply nested provide/use chain', () => {
    const ctx = createContext('root');
    const d1 = provideContext(ctx, 'level-1');
    const d2 = provideContext(ctx, 'level-2');
    const d3 = provideContext(ctx, 'level-3');
    expect(useContext(ctx)).toBe('level-3');
    d3();
    expect(useContext(ctx)).toBe('level-2');
    d2();
    expect(useContext(ctx)).toBe('level-1');
    d1();
    expect(useContext(ctx)).toBe('root');
  });

  it('two independent context keys do not interfere', () => {
    const theme = createContext<'light' | 'dark'>('light');
    const lang = createContext<string>('en');
    const dT = provideContext(theme, 'dark');
    const dL = provideContext(lang, 'fr');
    expect(useContext(theme)).toBe('dark');
    expect(useContext(lang)).toBe('fr');
    dT();
    expect(useContext(theme)).toBe('light');
    expect(useContext(lang)).toBe('fr');
    dL();
  });
});
