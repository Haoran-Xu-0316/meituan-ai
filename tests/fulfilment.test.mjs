import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { createExchange, transition, rescheduleExchange, artifactUrl, loadState, availableLessonTimes } from '../src/model.mjs';
const now = new Date('2026-09-19T08:00:00Z');
const partner = PEOPLE.find(p => p.id === 'lin');
const input = {teach:'摄影',learn:'Python',format:'视频交流',note:'互相分享',times:['2026-09-20T12:00:00Z','2026-09-23T12:00:00Z']};
function scenario() {
  const state = initialState();
  const exchange = createExchange(state, partner, input, now);
  transition(exchange, 'accept');
  return {state, exchange};
}
test('partial fulfilment remains open, releases the paused slot, and resumes only the remaining lesson', () => {
  const {state, exchange:e} = scenario();
  transition(e, 'completeLesson', {index:0, reflection:'完成构图练习', goalStatus:'achieved', artifact:'https://example.com/photo'});
  const completed = structuredClone(e.lessons[0]);
  transition(e, 'cancel', {reason:'临时加班'});
  assert.equal(e.status,'rescheduling');
  assert.ok(availableLessonTimes(state, partner.slots, now).includes('2026-09-23T12:00:00.000Z'));
  assert.throws(()=>createExchange(state, partner, input, now), /有效邀请/);
  assert.throws(()=>transition(e,'completeLesson',{index:1}), /确认/);
  rescheduleExchange(state,e,['2026-09-25T12:00:00Z'],now);
  assert.deepEqual(e.lessons[0],completed);
  assert.equal(e.status,'learning');
  assert.equal(e.lessons[1].at,'2026-09-25T12:00:00Z');
  assert.equal(e.reason,undefined);
  assert.equal(loadState({getItem:()=>JSON.stringify(state)}).warning,undefined);
});
test('rescheduling validates conflicts, past dates, and two-lesson order before mutation', () => {
  const {state,exchange:e} = scenario();
  const other = structuredClone(e); other.id='other'; other.lessons[0].at='2026-09-25T12:00:00Z'; state.exchanges.push(other);
  const snapshot = structuredClone(e);
  for(const times of [['2026-09-18T12:00:00Z','2026-09-24T12:00:00Z'],['2026-09-25T12:00:00Z','2026-09-26T12:00:00Z'],['2026-09-24T12:00:00Z','2026-09-22T12:00:00Z']]) {
    assert.throws(()=>rescheduleExchange(state,e,times,now));
    assert.deepEqual(e,snapshot);
  }
});
test('unfinished learning can record a specific obstacle without pretending the goal was achieved', () => {
  const {state,exchange:e} = scenario();
  assert.throws(()=>transition(e,'completeLesson',{index:0,goalStatus:'needs-help'}),/帮助/);
  assert.equal(e.lessons[0].done,false);
  transition(e,'completeLesson',{index:0,goalStatus:'needs-help',reflection:'还不确定逆光时如何曝光'});
  transition(e,'completeLesson',{index:1,goalStatus:'achieved',reflection:'独立合并两张表'});
  assert.equal(e.status,'review');
  assert.equal(e.lessons[0].goalStatus,'needs-help');
  assert.equal(loadState({getItem:()=>JSON.stringify(state)}).state.exchanges[0].lessons[0].reflection,'还不确定逆光时如何曝光');
});
test('artifact links reject executable schemes and credentials before completing a lesson', () => {
  const {exchange:e} = scenario();
  for(const artifact of ['javascript:alert(1)','data:text/html,hello','https://user:secret@example.com','not a url']) {
    assert.throws(()=>transition(e,'completeLesson',{index:0,artifact}));
    assert.equal(e.lessons[0].done,false);
  }
  assert.equal(artifactUrl(' https://example.com/作品 '),'https://example.com/%E4%BD%9C%E5%93%81');
});
test('untouched exchanges still cancel normally and finished exchanges cannot be rescheduled', () => {
  const {state,exchange:e} = scenario();
  transition(e,'cancel',{reason:'暂时不需要'});
  assert.equal(e.status,'cancelled');
  assert.throws(()=>rescheduleExchange(state,e,input.times,now));
});
