import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { createExchange, transition, exchangeActions, rescheduleExchange, askDemoQuestion, addExchangeMessage, loadState } from '../src/model.mjs';
const now = new Date('2026-09-19T08:00:00Z');
const person = PEOPLE.find(p => p.id === 'lin');
const input = {teach:'摄影',learn:'Python',format:'视频交流',note:'一起练习',times:['2026-09-20T12:00:00Z','2026-09-23T12:00:00Z']};
function scenario(accept = true) {
  const state = initialState();
  const e = createExchange(state, person, input, now);
  if (accept) transition(e,'accept',{},now);
  return {state,e};
}
test('action policy consistently closes all mutating routes for terminal exchanges', () => {
  const {e} = scenario();
  for (const status of ['completed','cancelled','declined']) {
    const record={...e,status}; const actions=exchangeActions(record,now);
    assert.equal(Object.entries(actions).filter(([key])=>key!=='completeLesson').some(([,value])=>value),false);
    assert.deepEqual(actions.completeLesson,[false,false]);
    for(const action of ['accept','decline','cancel','settle','completeLesson','review']) {
      const snapshot=structuredClone(record);
      assert.throws(()=>transition(record,action,{index:0,reason:'结束',rating:5,text:'评价'},now));
      assert.deepEqual(record,snapshot);
    }
  }
});
test('a later lesson cannot be recorded before its prerequisite', () => {
  const {e} = scenario();
  assert.deepEqual(exchangeActions(e,now).completeLesson,[true,false]);
  assert.throws(()=>transition(e,'completeLesson',{index:1}),/前一节/);
  assert.equal(e.lessons[1].done,false);
  transition(e,'completeLesson',{index:0});
  assert.deepEqual(exchangeActions(e,now).completeLesson,[false,true]);
});
test('an expired invitation requires fresh proposed times and explicit acceptance', () => {
  const {state,e}=scenario(false);
  const later=new Date('2026-09-21T08:00:00Z');
  assert.equal(exchangeActions(e,later).accept,false);
  assert.throws(()=>transition(e,'accept',{},later),/时间已过/);
  assert.equal(e.status,'pending');
  rescheduleExchange(state,e,['2026-09-22T12:00:00Z','2026-09-24T12:00:00Z'],later);
  assert.equal(e.status,'pending');
  assert.equal(e.messages.at(-1).by,'me');
  assert.match(e.messages.at(-1).text,/等待对方/);
  transition(e,'accept',{},later);
  assert.equal(e.status,'scheduled');
});
test('paused reciprocal obligations remain communicable and can end only through explicit agreement', () => {
  const {state,e}=scenario();
  transition(e,'completeLesson',{index:0,reflection:'完成曝光练习'});
  const completed=structuredClone(e.lessons[0]);
  transition(e,'cancel',{reason:'临时变动'});
  assert.equal(exchangeActions(e).communicate,true);
  assert.equal(exchangeActions(e).cancel,false);
  askDemoQuestion(e,'scope',now);
  assert.throws(()=>transition(e,'settle',{reason:' '}));
  assert.equal(e.status,'rescheduling');
  transition(e,'settle',{reason:'双方同意不再继续剩余课程'},now);
  assert.equal(e.status,'cancelled');
  assert.equal(e.resolution,'mutual-end');
  assert.deepEqual(e.lessons[0],completed);
  assert.equal(e.lessons[1].done,false);
  assert.equal(e.review,null);
  assert.equal(loadState({getItem:()=>JSON.stringify(state)}).state.exchanges[0].resolution,'mutual-end');
  assert.throws(()=>askDemoQuestion(e,'needs',now),/已结束/);
  assert.doesNotThrow(()=>createExchange(state,person,input,now));
});
test('review labels cannot claim goal achievement while an obstacle remains', () => {
  const {e}=scenario();
  transition(e,'completeLesson',{index:0});
  transition(e,'completeLesson',{index:1,goalStatus:'needs-help',reflection:'还不会处理重复邮箱'});
  assert.throws(()=>transition(e,'review',{rating:5,text:'仍需练习',tags:['目标达成']}),/仍有目标/);
  assert.equal(e.status,'review');
  transition(e,'review',{rating:4,text:'还需练习去重',tags:['耐心友好']});
  assert.equal(e.status,'completed');
  assert.equal(e.lessons[1].goalStatus,'needs-help');
});
test('an invitation snapshots goals for the selected skills and rejects unrelated default goals', () => {
  const state=initialState(); state.me.teach=['Excel','摄影']; state.me.goal='制作Excel报表';
  assert.throws(()=>createExchange(state,person,input,now),/课程目标/);
  const e=createExchange(state,person,{...input,teachGoal:'练习逆光人像',learnGoal:'用Python清理重复邮箱'},now);
  state.me.goal='新的个人简介目标';
  assert.equal(e.lessons[0].goal,'练习逆光人像');
  assert.equal(e.lessons[1].goal,'用Python清理重复邮箱');
});

test('free messages follow the same lifecycle policy as suggested questions', () => {
  const {e}=scenario();
  transition(e,'completeLesson',{index:0});
  transition(e,'cancel',{reason:'改期'});
  addExchangeMessage(e,'我们改到周末吗？',now);
  assert.equal(e.messages.at(-1).text,'我们改到周末吗？');
  transition(e,'settle',{reason:'双方同意结束'},now);
  const length=e.messages.length;
  assert.throws(()=>addExchangeMessage(e,'继续留言',now),/已结束/);
  assert.equal(e.messages.length,length);
});
