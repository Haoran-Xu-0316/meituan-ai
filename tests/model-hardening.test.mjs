import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { createExchange, transition, loadState, rescheduleExchange, partnerAction, saveInviteDraft } from '../src/model.mjs';

const now = new Date('2026-09-22T08:00:00Z');
const person = PEOPLE.find(person => person.id === 'lin');
const input = { teach: '摄影', learn: 'Python', format: '视频交流', note: '练习逆光和表格整理', times: ['2026-09-23T12:00:00Z', '2026-09-24T12:00:00Z'] };
const reload = state => loadState({ getItem: () => JSON.stringify(state) });
function scenario() {
  const state = initialState();
  const exchange = createExchange(state, person, input, now);
  return { state, exchange };
}

test('one corrupt agreement does not erase valid agreements, the profile, favorites or drafts', () => {
  const { state, exchange } = scenario();
  state.me.name = '保留的用户';
  state.favorites = ['lin'];
  state.draft = { ...structuredClone(state.me), goal: '' };
  state.draftStep = 2;
  state.exchanges.push(null, { id: 'broken' });
  const restored = reload(state);
  assert.match(restored.warning, /2条交换记录/);
  assert.deepEqual(restored.state.exchanges, [exchange]);
  assert.deepEqual(restored.state.me, state.me);
  assert.deepEqual(restored.state.favorites, ['lin']);
  assert.equal(restored.state.draft.goal, '');
  assert.equal(restored.state.draftStep, 2);
});

test('inconsistent course progress and invalid inherited statuses are isolated during restore', () => {
  const { state, exchange } = scenario();
  const variants = [
    { ...structuredClone(exchange), id: 'status', status: 'toString' },
    { ...structuredClone(exchange), id: 'review', status: 'review' },
    { ...structuredClone(exchange), id: 'out-of-order', status: 'learning', lessons: exchange.lessons.map((lesson, index) => ({ ...lesson, done: index === 1 })) },
  ];
  state.exchanges.push(...variants);
  const restored = reload(state);
  assert.match(restored.warning, /3条/);
  assert.deepEqual(restored.state.exchanges, [exchange]);
});

test('duplicate record ids cannot route to two different agreements after reload', () => {
  const { state, exchange } = scenario();
  state.exchanges.push({ ...structuredClone(exchange), note: '重复记录' });
  const restored = reload(state);
  assert.match(restored.warning, /1条/);
  assert.deepEqual(restored.state.exchanges, [exchange]);
});

test('legacy completed lessons without newer optional outcome fields remain readable', () => {
  const { state, exchange } = scenario();
  transition(exchange, 'accept', {}, now);
  transition(exchange, 'completeLesson', { index: 0 }, now);
  transition(exchange, 'completeLesson', { index: 1 }, now);
  transition(exchange, 'review', { rating: 5, text: '完成两次分享', tags: ['讲解清楚'] }, now);
  for (const lesson of exchange.lessons) {
    delete lesson.goalStatus;
    delete lesson.artifact;
    delete lesson.completedAt;
    delete lesson.reflection;
  }
  const restored = reload(state);
  assert.equal(restored.warning, undefined);
  assert.deepEqual(restored.state.exchanges, [exchange]);
});

test('exchange and profile draft recovery report both problems without resetting healthy data', () => {
  const { state, exchange } = scenario();
  state.draft = { teach: null };
  state.exchanges.push({ id: 'broken' });
  const restored = reload(state);
  assert.match(restored.warning, /交换记录/);
  assert.match(restored.warning, /草稿/);
  assert.deepEqual(restored.state.exchanges, [exchange]);
  assert.equal(restored.state.draft, null);
});

test('rescheduling identifies the second invalid course and leaves agreement and messages unchanged', () => {
  const { state, exchange } = scenario();
  const before = structuredClone(exchange);
  for (const times of [
    ['2026-09-25T12:00:00Z', '2026-09-21T12:00:00Z'],
    ['2026-09-25T12:00:00Z', '2026-10-10T12:00:00Z'],
    ['2026-09-25T12:00:00Z', '2026-09-25T12:30:00Z'],
    ['2026-09-25T12:00:00Z', '2026-09-24T12:00:00Z'],
  ]) {
    assert.throws(() => rescheduleExchange(state, exchange, times, now), error => error.field === 'time2');
    assert.deepEqual(exchange, before);
  }
});

test('second-course reservation conflicts target time2 while exactly adjacent classes are allowed', () => {
  const { state, exchange } = scenario();
  state.exchanges.push({ id: 'other', status: 'scheduled', lessons: [{ at: '2026-09-26T12:00:00Z', done: false }] });
  const before = structuredClone(exchange);
  assert.throws(() => rescheduleExchange(state, exchange, ['2026-09-25T12:00:00Z', '2026-09-26T12:30:00Z'], now), error => error.field === 'time2' && /已有其他/.test(error.message));
  assert.deepEqual(exchange, before);
  rescheduleExchange(state, exchange, ['2026-09-25T12:00:00Z', '2026-09-26T12:45:00Z'], now);
  assert.equal(exchange.lessons[1].at, '2026-09-26T12:45:00Z');
  assert.equal(exchange.status, 'pending');
});

test('one remaining rescheduled lesson reports time1 even when it is the second course', () => {
  const { state, exchange } = scenario();
  transition(exchange, 'accept', {}, now);
  transition(exchange, 'completeLesson', { index: 0 }, now);
  transition(exchange, 'cancel', { reason: '工作时间变化' }, now);
  const before = structuredClone(exchange);
  assert.throws(() => rescheduleExchange(state, exchange, ['2026-09-20T12:00:00Z'], now), error => error.field === 'time1');
  assert.deepEqual(exchange, before);
});

test('saved invitation drafts get a resume action without hiding existing agreements', () => {
  const state = initialState();
  saveInviteDraft(state, person, { teach: '摄影', learn: 'Python', format: '视频交流', teachGoal: '', learnGoal: '', time1: '', time2: '', note: '尚未完成' });
  assert.deepEqual(partnerAction(state, person), { path: '/invite/lin', label: '继续填写邀请' });
  const exchange = createExchange(state, person, input, now);
  assert.deepEqual(partnerAction(state, person), { path: `/exchange/${exchange.id}`, label: '查看邀请' });
  state.me.active = false;
  assert.equal(partnerAction(state, person).label, '查看邀请');
  state.exchanges = [];
  assert.equal(partnerAction(state, person).label, '调整供需后交换');
});
