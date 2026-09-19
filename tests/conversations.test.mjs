import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { createExchange, transition, askDemoQuestion, DEMO_QUESTIONS, loadState } from '../src/model.mjs';
const now = new Date('2026-09-19T08:00:00Z');
const partner = PEOPLE.find(p => p.id === 'lin');
function scenario() {
  const state = initialState();
  const exchange = createExchange(state, partner, {
    teach: '摄影', learn: 'Python', format: '视频交流', note: '想练报名表合并',
    times: ['2026-09-20T12:00:00Z', '2026-09-23T12:00:00Z'],
  }, now);
  return { state, exchange };
}
test('all fictional profiles have distinct motivations, obstacles and teaching limits', () => {
  for (const p of PEOPLE) {
    for (const field of ['purpose', 'obstacle', 'boundary', 'style', 'acceptNote']) assert.ok(p.context[field]?.trim(), p.id + ':' + field);
  }
  assert.equal(new Set(PEOPLE.map(p => p.context.purpose)).size, PEOPLE.length);
  assert.equal(new Set(PEOPLE.map(p => p.context.acceptNote)).size, PEOPLE.length);
});
test('sample question creates a labeled contextual reply and preserves exchange state', () => {
  const { exchange } = scenario();
  askDemoQuestion(exchange, 'preparation', now);
  assert.equal(exchange.status, 'pending');
  assert.equal(exchange.messages.length, 3);
  assert.equal(exchange.messages[1].text, DEMO_QUESTIONS.preparation);
  assert.equal(exchange.messages[2].demo, true);
  assert.ok(exchange.messages[2].text.includes(partner.lesson.prepare[0]));
  assert.ok(exchange.messages[2].text.includes(partner.context.style));
  assert.equal(exchange.messages[2].at, now.toISOString());
});
test('duplicate and invalid questions do not add messages, and markers survive reload', () => {
  const { state, exchange } = scenario();
  askDemoQuestion(exchange, 'needs', now);
  assert.throws(() => askDemoQuestion(exchange, 'needs', now), /已有回复/);
  assert.throws(() => askDemoQuestion(exchange, '__proto__', now), /有效/);
  assert.equal(exchange.messages.length, 3);
  const saved = loadState({ getItem: () => JSON.stringify(state) });
  assert.equal(saved.warning, undefined);
  assert.throws(() => askDemoQuestion(saved.state.exchanges[0], 'needs', now), /已有回复/);
});
test('acceptance is partner-specific and finished exchanges cannot simulate new replies', () => {
  const { exchange } = scenario();
  transition(exchange, 'accept');
  assert.equal(exchange.messages.at(-1).text, partner.context.acceptNote);
  askDemoQuestion(exchange, 'scope', now);
  assert.ok(exchange.messages.at(-1).text.includes(exchange.lessons[1].goal));
  assert.ok(exchange.messages.at(-1).text.includes(partner.context.boundary));
  transition(exchange, 'cancel', { reason: '另约时间' });
  const count = exchange.messages.length;
  assert.throws(() => askDemoQuestion(exchange, 'needs', now), /已结束/);
  assert.equal(exchange.messages.length, count);
});
