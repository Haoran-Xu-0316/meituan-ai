import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneRenderer, mountTransitions } from '../src/transitions.mjs';

function preference(matches = false) {
  const media = new EventTarget();
  media.matches = matches;
  media.listeners = new Set();
  const add = media.addEventListener.bind(media), remove = media.removeEventListener.bind(media);
  media.addEventListener = (type, handler, options) => { media.listeners.add(handler); add(type, handler, options); };
  media.removeEventListener = (type, handler) => { media.listeners.delete(handler); remove(type, handler); };
  media.set = value => { media.matches = value; media.dispatchEvent(new Event('change')); };
  return media;
}

function sceneFixture(media) {
  const transitions = [];
  let paints = 0;
  const doc = {
    defaultView: { matchMedia: () => media },
    documentElement: { dataset: { motion: 'on' } },
    querySelector: () => ({ dataset: { transitionKey: '/matches' } }),
    startViewTransition(update) {
      let finish, rejectReady;
      const transition = {
        update,
        ready: new Promise((_, reject) => { rejectReady = reject; }),
        finished: new Promise(resolve => { finish = resolve; }),
        finish,
        skipTransition() { this.skipped = true; rejectReady(new Error('skipped')); finish(); },
      };
      transitions.push(transition);
      return transition;
    },
  };
  return { doc, transitions, render: createSceneRenderer(doc, () => paints++), paints: () => paints };
}

// The OS preference may change before mountMotion synchronizes data-motion.
test('system reduced motion skips capture even when the persisted UI preference is on', () => {
  const fixture = sceneFixture(preference(true));
  let focused = false;
  fixture.render(() => { focused = true; });
  assert.equal(fixture.transitions.length, 0);
  assert.equal(fixture.paints(), 1);
  assert.equal(focused, true);
  assert.equal(fixture.doc.documentElement.dataset.scenePhase, 'idle');
});

test('enabling reduced motion interrupts capture without dropping the pending content or focus', async () => {
  const media = preference(), fixture = sceneFixture(media);
  let focused = false;
  fixture.render(() => { focused = true; });
  assert.equal(media.listeners.size, 1);
  media.set(true);
  assert.equal(fixture.transitions[0].skipped, true);
  assert.equal(media.listeners.size, 0);
  fixture.transitions[0].update();
  await Promise.resolve();
  assert.equal(fixture.paints(), 1);
  assert.equal(focused, true);
  assert.equal(fixture.doc.documentElement.dataset.scenePhase, 'idle');
});

test('rapid scene changes retain only the latest preference listener and commit', async () => {
  const media = preference(), fixture = sceneFixture(media);
  const focus = [];
  fixture.render(() => focus.push('old'));
  fixture.render(() => focus.push('new'));
  assert.equal(media.listeners.size, 1);
  fixture.transitions[0].update();
  fixture.transitions[1].update();
  fixture.transitions[1].finish();
  await Promise.resolve();
  assert.equal(media.listeners.size, 0);
  assert.deepEqual(focus, ['new']);
  assert.equal(fixture.paints(), 1);
});

function replaceGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
}

test('liquid highlight settles after real size changes but keeps moving on the first observer callback', t => {
  const media = preference();
  replaceGlobal(t, 'document', { defaultView: { matchMedia: () => media }, documentElement: { dataset: { motion: 'on' } } });
  let resized, disconnected = false, cancelled = 0;
  const observed = [];
  replaceGlobal(t, 'ResizeObserver', class {
    constructor(callback) { resized = callback; }
    observe(element) { observed.push(element); }
    disconnect() { disconnected = true; }
  });
  let target = { left: 100, top: 20, width: 100, height: 40 };
  const selected = { dataset: { value: '编程' }, getAttribute: () => null, getBoundingClientRect: () => target };
  const indicator = { style: {}, classList: { contains: () => true }, setAttribute() {}, animate() {
    return { finished: new Promise(() => {}), cancel() { cancelled++; } };
  } };
  const group = { scrollLeft: 0, scrollTop: 0, clientLeft: 0, clientTop: 0,
    classList: { add() {} }, append() {},
    getBoundingClientRect: () => ({ left: 0, top: 20, width: 400, height: 40 }),
    querySelector: selector => selector === '.liquid-indicator' ? indicator : selected,
  };
  const root = new EventTarget();
  root.querySelector = selector => selector === '.category-tabs' ? group : null;
  const dispose = mountTransitions(root, { groups: { category: {
    key: '全部', box: { left: 0, top: 20, width: 80, height: 40 }, scroll: 0,
  } } });
  assert.deepEqual(observed, [group, selected]);
  resized();
  assert.equal(cancelled, 0);
  target = { ...target, width: 140 };
  resized();
  assert.equal(cancelled, 1);
  assert.equal(indicator.style.width, '140px');
  resized();
  assert.equal(cancelled, 1);
  dispose();
  assert.equal(disconnected, true);
});

test('disclosures keep native keyboard activation under the system motion preference', t => {
  replaceGlobal(t, 'document', { defaultView: { matchMedia: () => preference(true) }, documentElement: { dataset: { motion: 'on' } } });
  const root = new EventTarget();
  root.querySelector = () => null;
  root.closest = selector => selector === 'summary' ? { parentElement: { tagName: 'DETAILS' } } : null;
  const dispose = mountTransitions(root);
  const activation = new Event('click', { cancelable: true });
  root.dispatchEvent(activation);
  assert.equal(activation.defaultPrevented, false);
  dispose();
});
