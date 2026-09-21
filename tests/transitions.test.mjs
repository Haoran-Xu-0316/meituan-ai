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
