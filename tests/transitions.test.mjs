import test from 'node:test';
import assert from 'node:assert/strict';
import { liquidFrames, captureTransition, mountTransitions } from '../src/transitions.mjs';

test('liquid selection starts at the current visual box and settles at the target', () => {
  const frames = liquidFrames({ left: 10, top: 20, width: 80, height: 40 }, { left: 110, top: 20, width: 100, height: 40 });
  assert.equal(frames[0].transform, 'translate(-100px, 0px) scale(0.8, 1)');
  assert.equal(frames.at(-1).transform, 'translate(0px, 0px) scale(1, 1)');
  assert.ok(frames[1].transform.includes('scale(1.055, 0.97)'));
  assert.equal(liquidFrames(null, { width: 100, height: 40 }), null);
  assert.equal(liquidFrames({}, { width: 0, height: 0 }), null);
});

test('selection snapshot uses the moving indicator instead of jumping to the old button', () => {
  const box = { left: 50, top: 30, width: 80, height: 40 };
  const selected = { dataset: { value: '编程' }, getAttribute: () => null, getBoundingClientRect: () => ({ ...box, left: 100 }) };
  const group = { scrollLeft: 24, querySelector: selector => selector === '.liquid-indicator' ? { getBoundingClientRect: () => box } : selected };
  const root = { querySelector: selector => selector === '.category-tabs' ? group : null };
  assert.deepEqual(captureTransition(root).groups.category, { key: '编程', box, scroll: 24 });
});

test('disclosure animation handles reversal and disposes pending work', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: { motion: 'on' } } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const root = new EventTarget(); root.querySelector = () => null;
  const runs = [];
  const details = { tagName: 'DETAILS', open: false,
    getBoundingClientRect() { return { height: this.open ? 200 : 40 }; },
    animate(frames) {
      let finish, reject;
      const animation = { frames, finished: new Promise((yes, no) => { finish = yes; reject = no; }), cancel() { this.cancelled = true; reject(new Error('cancel')); }, finish: () => finish() };
      runs.push(animation); return animation;
    },
  };
  const summary = { parentElement: details };
  root.closest = selector => selector === 'summary' ? summary : null;
  const dispose = mountTransitions(root);
  const click = () => root.dispatchEvent(new Event('click', { cancelable: true }));
  click(); assert.equal(details.open, true);
  assert.deepEqual(runs[0].frames.map(frame => frame.height), ['40px', '200px']);
  click(); assert.equal(runs[0].cancelled, true);
  runs[1].finish(); await Promise.resolve();
  assert.equal(details.open, false);
  click(); dispose();
  assert.equal(runs[2].cancelled, true);
  click(); assert.equal(runs.length, 3);
});

import { createSceneRenderer } from '../src/transitions.mjs';

test('scene switching commits only the latest request and runs focus work after painting', async () => {
  const calls = [], transitions = [];
  const doc = { documentElement: { dataset: { motion: 'on' } }, querySelector: () => ({}),
    startViewTransition(update) {
      let finish;
      const transition = { update, ready: Promise.resolve(), finished: new Promise(resolve => { finish = resolve; }), skipTransition() { this.skipped = true; finish(); }, finish: () => finish() };
      transitions.push(transition); return transition;
    },
  };
  const render = createSceneRenderer(doc, () => calls.push('paint'));
  render(() => calls.push('stale-focus'));
  render(() => calls.push('current-focus'));
  assert.equal(transitions[0].skipped, true);
  transitions[0].update(); transitions[1].update();
  assert.deepEqual(calls, ['paint', 'current-focus']);
  await Promise.resolve();
  assert.equal(doc.documentElement.dataset.scenePhase, 'animating');
  transitions[1].finish(); await Promise.resolve();
  assert.equal(doc.documentElement.dataset.scenePhase, 'idle');
});

test('reduced motion and unsupported browsers paint synchronously', () => {
  const doc = { documentElement: { dataset: { motion: 'off' } }, querySelector: () => ({}), startViewTransition() { throw new Error('must not animate'); } };
  let count = 0;
  const render = createSceneRenderer(doc, () => count++);
  render(); assert.equal(count, 1);
  doc.documentElement.dataset.motion = 'on'; delete doc.startViewTransition;
  render(); assert.equal(count, 2);
  assert.equal(doc.documentElement.dataset.sceneTransition, 'off');
});
