/**
 * Advanced rendering primitives for the Exba reactivity system.
 *
 * These composable helpers solve the five gaps that block complex UI:
 *  - Show:       conditional create/destroy of DOM subtrees
 *  - For:        keyed list rendering with DOM reuse
 *  - bindValue:  two-way reactive input binding
 *  - classList:  reactive conditional class toggling
 *  - html:       tagged template literal → DocumentFragment
 *
 * All primitives integrate with the Signal system from reactivity.ts
 * and return dispose functions for cleanup.
 */
import { effect, type Signal, untrack, watch } from './reactivity';

// ════════════════════════════════════════════════════════════
//  html — Tagged template → DocumentFragment
// ════════════════════════════════════════════════════════════

/**
 * Tagged template literal that produces a DocumentFragment from an HTML string.
 * Use for one-shot creation of DOM subtrees (not reactive by itself).
 *
 * @example
 * ```ts
 * const frag = html`<li class="item">Hello ${name}</li>`;
 * container.appendChild(frag);
 * ```
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DocumentFragment {
  const result = strings.reduce((acc, str, i) => {
    let v = values[i] !== undefined ? String(values[i]) : '';
    if (values[i] instanceof Node) {
      v = '';
    }
    return acc + str + v;
  }, '');
  const template = document.createElement('template');
  template.innerHTML = result;
  const fragment = template.content;

  // Append any Node values at marker positions
  const walker = document.createTreeWalker(fragment, 4);
  let index = 0;
  let node: ChildNode | null;
  while ((node = walker.nextNode() as ChildNode | null)) {
    if (node.nodeType === 8 && values[index] instanceof Node) {
      node.parentNode?.replaceChild(values[index] as Node, node);
    }
    index++;
  }

  return fragment;
}

// ════════════════════════════════════════════════════════════
//  Show — Conditional rendering
// ════════════════════════════════════════════════════════════

export interface ShowProps<T> {
  /** The container element or shadow root to manage */
  mount: Element | ShadowRoot;
  /** Signal or getter for the condition */
  when: () => T;
  /** Render when condition is truthy (receives the value) */
  children: (value: T) => Node | Node[];
  /** Render when condition is falsy */
  fallback?: () => Node | Node[];
}

/**
 * Conditionally create or destroy DOM content based on a signal.
 * Manages the content's lifecycle — calls `children()` when `when()` transitions
 * to truthy, and `fallback()` when falsy. Removes old DOM when condition changes.
 *
 * @example
 * ```ts
 * const dispose = createShow({
 *   mount: detailContainer,
 *   when: () => state.value.showDetail,
 *   children: () => html`<p>Detail content here</p>`,
 *   fallback: () => html`<p class="empty">Select an item</p>`,
 * });
 * disposables.add(dispose);
 * ```
 */
export function createShow<T>(props: ShowProps<T>): () => void {
  let currentNodes: Node[] = [];
  let previousTruthy: boolean | null = null;

  const dispose = effect(() => {
    const condition = props.when();
    const isTruthy = !!condition;

    if (isTruthy === previousTruthy && previousTruthy !== null) {
      // Same truthiness, update content if truthy
      if (isTruthy) {
        removeNodes(props.mount, currentNodes);
        currentNodes = toNodeArray(props.children(condition as unknown as T));
        appendNodes(props.mount, currentNodes);
      }
      return;
    }

    // Truthiness changed — swap content
    previousTruthy = isTruthy;
    removeNodes(props.mount, currentNodes);

    if (isTruthy) {
      currentNodes = toNodeArray(props.children(condition as unknown as T));
    } else if (props.fallback) {
      currentNodes = toNodeArray(props.fallback());
    } else {
      currentNodes = [];
    }

    appendNodes(props.mount, currentNodes);
  });

  return () => {
    dispose();
    removeNodes(props.mount, currentNodes);
    currentNodes = [];
  };
}

// ════════════════════════════════════════════════════════════
//  For — Keyed list rendering
// ════════════════════════════════════════════════════════════

export interface ForProps<T> {
  /** The container element or shadow root to manage */
  mount: Element | ShadowRoot;
  /** Signal or getter returning the item array */
  each: () => T[];
  /**
   * Key function to identify items across renders.
   * If omitted, uses array index.
   */
  keyed?: (item: T, index: number) => string | number;
  /**
   * Render function for each item.
   * Receives the item and a getter for the current index.
   */
  children: (item: T, index: () => number) => Node | Node[];
}

interface KeyedEntry<T> {
  key: string | number;
  item: T;
  /** Stable comment node anchoring this item's position */
  anchor: Comment;
  nodes: Node[];
}

/**
 * Keyed list rendering with DOM reuse.
 * Only creates/removes DOM nodes for items that actually changed,
 * preserving state (focus, scroll, form input values) for unchanged items.
 * When an item with the same key re-appears, the children() function is
 * called again and the DOM is updated in-place via the anchor comment marker.
 *
 * @example
 * ```ts
 * const dispose = createFor({
 *   mount: listContainer,
 *   each: () => state.value.items,
 *   keyed: (item) => item.id,
 *   children: (item, index) => html`<li>${index()} - ${item.name}</li>`,
 * });
 * disposables.add(dispose);
 * ```
 */
export function createFor<T>(props: ForProps<T>): () => void {
  const entries: KeyedEntry<T>[] = [];
  const anchor = document.createComment('for');
  props.mount.appendChild(anchor);

  const dispose = effect(() => {
    const items = props.each();
    const keyed = props.keyed ?? ((_: T, i: number) => i);

    // Build a map of current entries by key
    const prevByKey = new Map<string | number, KeyedEntry<T>>();
    for (const entry of entries) {
      prevByKey.set(entry.key, entry);
    }

    const newEntries: KeyedEntry<T>[] = [];
    const seenKeys = new Set<string | number>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = keyed(item, i);

      if (seenKeys.has(key)) {
        // Duplicate key — create fresh entry
        const entry = createEntry(props, item, key, i);
        entry.key = `__dup_${i}_${key}`;
        newEntries.push(entry);
        continue;
      }
      seenKeys.add(key);

      const existing = prevByKey.get(key);
      if (existing) {
        // Reuse — update item and DOM content in-place
        existing.item = item;
        replaceEntryContent(props.mount, existing, () =>
          toNodeArray(props.children(item, () => i)),
        );
        newEntries.push(existing);
      } else {
        // New item — create entry with anchor
        const entry = createEntry(props, item, key, i);
        newEntries.push(entry);
      }
    }

    // Remove stale entries
    const stale = entries.filter((e) => !newEntries.includes(e));
    for (const entry of stale) {
      removeNodes(props.mount, entry.nodes);
      if (entry.anchor.parentNode === props.mount) {
        props.mount.removeChild(entry.anchor);
      }
    }

    // Reorder and insert entries
    let refNode: Node | null = anchor;
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      const prevEntry = i < entries.length ? entries[i] : null;

      if (entry !== prevEntry) {
        // Ensure anchor is in the right position
        if (entry.anchor.parentNode !== props.mount) {
          props.mount.insertBefore(entry.anchor, refNode);
        } else if (entry.anchor.nextSibling !== refNode) {
          props.mount.insertBefore(entry.anchor, refNode);
        }
        // Ensure all nodes follow the anchor
        let insertAfter: Node = entry.anchor;
        for (const node of entry.nodes) {
          if (node.parentNode !== props.mount) {
            props.mount.insertBefore(node, insertAfter.nextSibling);
          } else if (node !== insertAfter.nextSibling) {
            props.mount.insertBefore(node, insertAfter.nextSibling);
          }
          insertAfter = node;
        }
      }
      refNode =
        entry.nodes.length > 0
          ? entry.nodes[entry.nodes.length - 1].nextSibling
          : entry.anchor.nextSibling;
    }

    entries.length = 0;
    entries.push(...newEntries);
  });

  return () => {
    dispose();
    for (const entry of entries) {
      removeNodes(props.mount, entry.nodes);
      if (entry.anchor.parentNode === props.mount) {
        props.mount.removeChild(entry.anchor);
      }
    }
    if (anchor.parentNode === props.mount) {
      props.mount.removeChild(anchor);
    }
  };
}

function createEntry<T>(
  props: ForProps<T>,
  item: T,
  key: string | number,
  index: number,
): KeyedEntry<T> {
  const anchor = document.createComment('for-item');
  const nodes = toNodeArray(props.children(item, () => index));
  props.mount.appendChild(anchor);
  for (const node of nodes) {
    props.mount.appendChild(node);
  }
  return { key, item, anchor, nodes };
}

function replaceEntryContent(
  parent: Element | ShadowRoot,
  entry: KeyedEntry<any>,
  newNodesFn: () => Node[],
): void {
  removeNodes(parent, entry.nodes);
  const newNodes = newNodesFn();
  let ref = entry.anchor.nextSibling;
  for (const node of newNodes) {
    if (ref) {
      parent.insertBefore(node, ref);
    } else {
      parent.appendChild(node);
    }
    ref = node.nextSibling;
  }
  entry.nodes = newNodes;
}

// ════════════════════════════════════════════════════════════
//  bindValue — Two-way input binding
// ════════════════════════════════════════════════════════════

/**
 * Two-way reactive binding between an input element and a signal.
 * - Reads from signal → updates input.value (one-way)
 * - Listens to 'input' event → calls setter (other way)
 *
 * @example
 * ```ts
 * const dispose = createBindValue(
 *   searchInput,
 *   () => state.value.query,
 *   (val) => { state.value = { ...state.value, query: val }; },
 * );
 * disposables.add(dispose);
 * ```
 */
export function createBindValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  get: () => string,
  set: (value: string) => void,
): () => void {
  const disposeSignal = effect(() => {
    const val = get();
    if (el.value !== val) {
      el.value = val;
    }
  });

  const handler = () => {
    set(el.value);
  };
  el.addEventListener('input', handler);

  return () => {
    disposeSignal();
    el.removeEventListener('input', handler);
  };
}

// ════════════════════════════════════════════════════════════
//  classList — Reactive conditional class management
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  createRef — DOM element reference capture
// ════════════════════════════════════════════════════════════

/**
 * Create a mutable ref container for capturing a DOM element.
 * Unlike signals, refs are NOT reactive — reading `ref.current` does not
 * create a tracking dependency. Use refs for third-party library
 * integrations or reading element properties imperatively.
 *
 * @example
 * ```ts
 * const inputRef = createRef<HTMLInputElement>();
 *
 * // In renderInitial or setupEffects:
 * this.$('#my-input') && (inputRef.current = this.$('#my-input')!);
 *
 * // Later:
 * inputRef.current?.focus();
 * ```
 */
export interface Ref<T extends Element = HTMLElement> {
  current: T | null;
}

export function createRef<T extends Element = HTMLElement>(
  initial: T | null = null,
): Ref<T> {
  return { current: initial };
}

// ════════════════════════════════════════════════════════════
//  classList — Reactive conditional class management
// ════════════════════════════════════════════════════════════

/**
 * Reactively toggle CSS classes on an element based on signal values.
 * Unlike `el.classList.toggle()`, this is fully reactive and managed.
 *
 * @example
 * ```ts
 * createClassList(el, {
 *   active: () => state.value.isActive,
 *   'has-error': () => state.value.error !== null,
 *   hidden: () => !state.value.visible,
 * });
 * ```
 */
export function createClassList(
  el: HTMLElement,
  classes: Record<string, () => boolean>,
): () => void {
  const keys = Object.keys(classes);
  const disposeFns: (() => void)[] = [];

  for (const key of keys) {
    const dispose = effect(() => {
      const shouldHave = classes[key]();
      el.classList.toggle(key, shouldHave);
    });
    disposeFns.push(dispose);
  }

  return () => {
    for (const dispose of disposeFns) {
      dispose();
    }
  };
}

// ════════════════════════════════════════════════════════════
//  Internal helpers
// ════════════════════════════════════════════════════════════

function toNodeArray(input: Node | Node[]): Node[] {
  if (Array.isArray(input)) return input;
  if (input instanceof DocumentFragment) {
    return Array.from(input.childNodes);
  }
  return [input];
}

function appendNodes(parent: Element | ShadowRoot, nodes: Node[]): void {
  for (const node of nodes) {
    parent.appendChild(node);
  }
}

function removeNodes(parent: Element | ShadowRoot, nodes: Node[]): void {
  for (const node of nodes) {
    if (node.parentNode === parent) {
      parent.removeChild(node);
    }
  }
}
