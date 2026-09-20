import test from 'node:test';
import assert from 'node:assert/strict';
import { pointerPose, mountMotion } from '../src/motion.mjs';

test('pointer tilt remains bounded outside a card and stable at its center', () => {
  assert.deepEqual(pointerPose(100, 50, 200, 100), { rx: 0, ry: 0, lightX: 50, lightY: 50 });
  assert.deepEqual(pointerPose(-90, 300, 200, 100), { rx: -3, ry: -3, lightX: 0, lightY: 100 });
  assert.ok(Object.values(pointerPose(0, 0, 0, 0)).every(Number.isFinite));
});

function harness(t, reduced = false) {
  const mockGlobal = (name, value) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
  };
  const root = new EventTarget();
  const toggle = new EventTarget();
  const attributes = {};
  toggle.setAttribute = (name, value) => { attributes[name] = value; };
  root.querySelector = () => toggle;
  const properties = new Map();
  const card = { classList: { add() {}, remove() {} }, style: {
    setProperty: (k,v) => properties.set(k,v), removeProperty: k => properties.delete(k),
  }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }), contains: () => false };
  root.closest = () => card;
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.documentElement = { dataset: {} };
  const queries = [];
  let frame, cancelled = 0;
  mockGlobal('window', win);
  mockGlobal('document', doc);
  mockGlobal('matchMedia', query => {
    const media = new EventTarget();
    media.matches = query.includes('reduce') ? reduced : true;
    queries.push(media); return media;
  });
  mockGlobal('requestAnimationFrame', callback => { frame = callback; return 1; });
  mockGlobal('cancelAnimationFrame', id => { if (id) cancelled++; });
  const move = () => {
    const event = new Event('pointermove');
    Object.assign(event, { pointerType: 'mouse', clientX: 180, clientY: 10 });
    root.dispatchEvent(event);
  };
  return { root, toggle, doc, properties, attributes, move, runFrame: () => frame?.(), cancelled: () => cancelled, queries };
}

test('route cleanup cancels a queued frame and removes old motion listeners', t => {
  const h = harness(t);
  const dispose = mountMotion(h.root);
  h.move(); h.runFrame();
  assert.ok(Math.abs(parseFloat(h.properties.get('--tilt-y')) - 2.4) < 0.001);
  h.move(); dispose();
  assert.ok(h.cancelled() > 0);
  assert.equal(h.properties.size, 0);
  h.move();
  assert.equal(h.properties.size, 0);
});

test('system reduced motion disables tilt and the optional toggle', t => {
  const h = harness(t, true);
  const dispose = mountMotion(h.root);
  assert.equal(h.doc.documentElement.dataset.motion, 'off');
  assert.equal(h.toggle.disabled, true);
  assert.equal(h.attributes['aria-pressed'], 'false');
  h.move(); h.runFrame();
  assert.equal(h.properties.size, 0);
  dispose();
});
