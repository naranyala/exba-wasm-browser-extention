import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effect, signal } from './reactivity';
import {
  createBindValue,
  createClassList,
  createFor,
  createRef,
  createShow,
  html,
} from './render';

// ─────────────────────────────────────────────────────────────────────────────
//  html — Tagged template literal
// ─────────────────────────────────────────────────────────────────────────────
describe('html', () => {
  it('produces a DocumentFragment from a simple string', () => {
    const frag = html`<p>Hello</p>`;
    expect(frag).toBeInstanceOf(DocumentFragment);
  });

  it('interpolates string values', () => {
    const name = 'World';
    const frag = html`<span>${name}</span>`;
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('span')?.textContent).toBe('World');
  });

  it('handles multiple interpolations', () => {
    const a = 'foo',
      b = 'bar';
    const frag = html`<p>${a} - ${b}</p>`;
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.textContent).toBe('foo - bar');
  });

  it('handles no interpolations', () => {
    const frag = html`<div class="test">Static</div>`;
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('.test')?.textContent).toBe('Static');
  });

  it('handles undefined interpolation gracefully', () => {
    const val: any = undefined;
    const frag = html`<span>${val}</span>`;
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('span')?.textContent).toBe('');
  });

  it('creates multiple sibling elements', () => {
    const frag = html`<li>A</li><li>B</li><li>C</li>`;
    const ul = document.createElement('ul');
    ul.appendChild(frag);
    expect(ul.querySelectorAll('li')).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createShow — Conditional rendering
// ─────────────────────────────────────────────────────────────────────────────
describe('createShow', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders children when condition is truthy on mount', () => {
    const flag = signal(true);
    createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        p.textContent = 'visible';
        return p;
      },
    });
    expect(container.querySelector('p')?.textContent).toBe('visible');
  });

  it('renders nothing when condition is falsy and no fallback', () => {
    const flag = signal(false);
    createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        p.textContent = 'hidden';
        return p;
      },
    });
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders fallback when condition is falsy', () => {
    const flag = signal(false);
    createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        p.textContent = 'main';
        return p;
      },
      fallback: () => {
        const span = document.createElement('span');
        span.textContent = 'fallback';
        return span;
      },
    });
    expect(container.querySelector('span')?.textContent).toBe('fallback');
  });

  it('swaps children → fallback when condition goes false', () => {
    const flag = signal(true);
    createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        p.textContent = 'main';
        return p;
      },
      fallback: () => {
        const span = document.createElement('span');
        span.textContent = 'fallback';
        return span;
      },
    });
    expect(container.querySelector('p')).toBeTruthy();
    flag.value = false;
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('span')?.textContent).toBe('fallback');
  });

  it('swaps fallback → children when condition goes true', () => {
    const flag = signal(false);
    createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        p.textContent = 'main';
        return p;
      },
      fallback: () => {
        const span = document.createElement('span');
        span.textContent = 'fallback';
        return span;
      },
    });
    expect(container.querySelector('span')).toBeTruthy();
    flag.value = true;
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('main');
  });

  it('dispose removes content from DOM', () => {
    const flag = signal(true);
    const dispose = createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        return p;
      },
    });
    expect(container.querySelector('p')).toBeTruthy();
    dispose();
    expect(container.querySelector('p')).toBeNull();
  });

  it('dispose stops reactivity', () => {
    const flag = signal(false);
    const dispose = createShow({
      mount: container,
      when: () => flag.value,
      children: () => {
        const p = document.createElement('p');
        return p;
      },
    });
    dispose();
    flag.value = true;
    expect(container.querySelector('p')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createFor — Keyed list rendering
// ─────────────────────────────────────────────────────────────────────────────
describe('createFor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('ul');
    document.body.appendChild(container);
  });

  it('renders initial list', () => {
    const items = signal(['a', 'b', 'c']);
    createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelectorAll('li')[0].textContent).toBe('a');
  });

  it('renders empty list without errors', () => {
    const items = signal<string[]>([]);
    createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('adds items when array grows', () => {
    const items = signal(['a', 'b']);
    createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    items.value = ['a', 'b', 'c'];
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('removes items when array shrinks', () => {
    const items = signal(['a', 'b', 'c']);
    createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    items.value = ['a'];
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelectorAll('li')[0].textContent).toBe('a');
  });

  it('dispose clears all rendered items', () => {
    const items = signal(['x', 'y']);
    const dispose = createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    dispose();
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('provides correct index to children', () => {
    const items = signal(['a', 'b', 'c']);
    const indices: number[] = [];
    createFor({
      mount: container,
      each: () => items.value,
      keyed: (item) => item,
      children: (_, getIndex) => {
        indices.push(getIndex());
        const li = document.createElement('li');
        return li;
      },
    });
    expect(indices).toEqual([0, 1, 2]);
  });

  it('uses index as key when keyed is not provided', () => {
    const items = signal(['a', 'b']);
    createFor({
      mount: container,
      each: () => items.value,
      children: (item) => {
        const li = document.createElement('li');
        li.textContent = item;
        return li;
      },
    });
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createBindValue — Two-way input binding
// ─────────────────────────────────────────────────────────────────────────────
describe('createBindValue', () => {
  it('sets initial input value from getter', () => {
    const input = document.createElement('input');
    const s = signal('initial');
    createBindValue(
      input,
      () => s.value,
      (v) => {
        s.value = v;
      },
    );
    expect(input.value).toBe('initial');
  });

  it('updates input.value when signal changes', () => {
    const input = document.createElement('input');
    const s = signal('first');
    createBindValue(
      input,
      () => s.value,
      (v) => {
        s.value = v;
      },
    );
    s.value = 'second';
    expect(input.value).toBe('second');
  });

  it('calls setter when input event fires', () => {
    const input = document.createElement('input');
    input.value = '';
    const setter = vi.fn();
    createBindValue(input, () => '', setter);
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    expect(setter).toHaveBeenCalledWith('typed');
  });

  it('dispose removes the input event listener', () => {
    const input = document.createElement('input');
    const setter = vi.fn();
    const dispose = createBindValue(input, () => '', setter);
    dispose();
    input.value = 'after-dispose';
    input.dispatchEvent(new Event('input'));
    expect(setter).not.toHaveBeenCalled();
  });

  it('works with textarea', () => {
    const textarea = document.createElement('textarea');
    const s = signal('hello');
    createBindValue(
      textarea,
      () => s.value,
      (v) => {
        s.value = v;
      },
    );
    expect(textarea.value).toBe('hello');
  });

  it('works with select element', () => {
    const select = document.createElement('select');
    const opt1 = document.createElement('option');
    opt1.value = 'a';
    const opt2 = document.createElement('option');
    opt2.value = 'b';
    select.appendChild(opt1);
    select.appendChild(opt2);
    const s = signal('a');
    createBindValue(
      select,
      () => s.value,
      (v) => {
        s.value = v;
      },
    );
    expect(select.value).toBe('a');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createClassList — Reactive conditional classes
// ─────────────────────────────────────────────────────────────────────────────
describe('createClassList', () => {
  it('adds class when condition is true', () => {
    const el = document.createElement('div');
    const active = signal(true);
    createClassList(el, { active: () => active.value });
    expect(el.classList.contains('active')).toBe(true);
  });

  it('does not add class when condition is false', () => {
    const el = document.createElement('div');
    const active = signal(false);
    createClassList(el, { active: () => active.value });
    expect(el.classList.contains('active')).toBe(false);
  });

  it('reactively adds class when condition becomes true', () => {
    const el = document.createElement('div');
    const active = signal(false);
    createClassList(el, { active: () => active.value });
    active.value = true;
    expect(el.classList.contains('active')).toBe(true);
  });

  it('reactively removes class when condition becomes false', () => {
    const el = document.createElement('div');
    const active = signal(true);
    createClassList(el, { active: () => active.value });
    active.value = false;
    expect(el.classList.contains('active')).toBe(false);
  });

  it('handles multiple classes independently', () => {
    const el = document.createElement('div');
    const a = signal(true);
    const b = signal(false);
    createClassList(el, { 'class-a': () => a.value, 'class-b': () => b.value });
    expect(el.classList.contains('class-a')).toBe(true);
    expect(el.classList.contains('class-b')).toBe(false);
    b.value = true;
    expect(el.classList.contains('class-b')).toBe(true);
  });

  it('dispose stops class updates', () => {
    const el = document.createElement('div');
    const active = signal(false);
    const dispose = createClassList(el, { active: () => active.value });
    dispose();
    active.value = true;
    expect(el.classList.contains('active')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createRef
// ─────────────────────────────────────────────────────────────────────────────
describe('createRef', () => {
  it('creates a ref with null as default', () => {
    const ref = createRef();
    expect(ref.current).toBeNull();
  });

  it('creates a ref with an initial element', () => {
    const el = document.createElement('input');
    const ref = createRef(el);
    expect(ref.current).toBe(el);
  });

  it('can be mutated', () => {
    const ref = createRef<HTMLInputElement>();
    const input = document.createElement('input');
    ref.current = input;
    expect(ref.current).toBe(input);
  });

  it('is not reactive (reading ref.current inside effect does not track it)', () => {
    const ref = createRef<HTMLElement>();
    let runs = 0;
    effect(() => {
      runs++;
      ref.current; // not reactive
    });
    runs = 0;
    ref.current = document.createElement('div');
    expect(runs).toBe(0);
  });
});
