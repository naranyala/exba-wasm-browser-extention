/**
 * Reactive event bus for WASM → JS events.
 *
 * Events are emitted by Rust modules during dispatch_action(),
 * accumulated in CoreEngine, and drained by WasmClient.
 * This bus provides a subscription-based API to consume them.
 */
import type { WasmModuleEvent } from '../wasm-types';

type EventHandler = (event: WasmModuleEvent) => void;

export class WasmEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();

  /**
   * Subscribe to all WASM events.
   * Returns a dispose function.
   */
  subscribe(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }

  /**
   * Subscribe to events from a specific module.
   * Returns a dispose function.
   */
  subscribeModule(moduleName: string, handler: EventHandler): () => void {
    const key = `module:${moduleName}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
    return () => this.handlers.get(key)?.delete(handler);
  }

  /**
   * Subscribe to events with a specific name.
   * Returns a dispose function.
   */
  subscribeEvent(eventName: string, handler: EventHandler): () => void {
    const key = `event:${eventName}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
    return () => this.handlers.get(key)?.delete(handler);
  }

  /**
   * Subscribe to events matching both module and event name.
   * Returns a dispose function.
   */
  subscribeExact(
    moduleName: string,
    eventName: string,
    handler: EventHandler,
  ): () => void {
    const key = `exact:${moduleName}:${eventName}`;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
    return () => this.handlers.get(key)?.delete(handler);
  }

  /**
   * Feed events into the bus. Called by WasmClient.
   */
  feed(events: WasmModuleEvent[]): void {
    for (const event of events) {
      // Wildcard handlers
      for (const h of this.wildcardHandlers) {
        h(event);
      }
      // Module-specific
      const modHandlers = this.handlers.get(`module:${event.module}`);
      if (modHandlers) {
        for (const h of modHandlers) h(event);
      }
      // Event name-specific
      const evtHandlers = this.handlers.get(`event:${event.name}`);
      if (evtHandlers) {
        for (const h of evtHandlers) h(event);
      }
      // Exact match
      const exactHandlers = this.handlers.get(
        `exact:${event.module}:${event.name}`,
      );
      if (exactHandlers) {
        for (const h of exactHandlers) h(event);
      }
    }
  }

  /**
   * Remove all handlers.
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  /**
   * Number of registered handlers.
   */
  get handlerCount(): number {
    let count = this.wildcardHandlers.size;
    for (const set of this.handlers.values()) {
      count += set.size;
    }
    return count;
  }
}
