import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { saveInviteDraft, readInviteDraft, loadState, createExchange } from '../src/model.mjs';
const lin = PEOPLE.find(p => p.id === 'lin');
const other = PEOPLE.find(p => p.id !== lin.id);
const now = new Date('2026-09-22T08:00:00Z');
const values = () => ({teach:'摄影',learn:'Python',format:'视频交流',teachGoal:'拍一张逆光人像',learnGoal:'用Python整理表格',time1:'2026-09-23T20:00',time2:'2026-09-24T20:00',note:'带上练习素材'});
const reload = state => loadState({getItem:()=>JSON.stringify(state)}).state;
const input = draft => ({...draft,times:[draft.time1,draft.time2].map(time=>`${time}:00+08:00`)});

test('partial invitation drafts survive reload independently without creating exchanges',()=>{
  const state=initialState();
  const partial={...values(),teachGoal:'',time2:'',note:'还在考虑'};
  assert.equal(saveInviteDraft(state,lin,partial),true);
  saveInviteDraft(state,other,{...values(),note:'另一位伙伴'});
  const restored=reload(state);
  assert.deepEqual(readInviteDraft(restored,lin),partial);
  assert.equal(restored.inviteDrafts[other.id].note,'另一位伙伴');
  assert.equal(restored.exchanges.length,0);
});
test('damaged invitation drafts are discarded without losing saved profile, favorites or agreements',()=>{
  const state=initialState();
  createExchange(state,lin,input(values()),now);
  state.favorites=[lin.id];
  const before=structuredClone(state);
  state.inviteDrafts={ [lin.id]: {...values(),note:[]}, [other.id]: {...values(),unknown:'ignored'}, unknown:values() };
  const restored=reload(state);
  assert.deepEqual(restored.exchanges,before.exchanges);
  assert.deepEqual(restored.me,before.me);
  assert.deepEqual(restored.favorites,before.favorites);
  assert.equal(restored.inviteDrafts[lin.id],undefined);
  assert.deepEqual(Object.keys(restored.inviteDrafts),[other.id]);
  assert.equal(restored.inviteDrafts[other.id].unknown,undefined);
});
test('unsupported draft collections and malformed times do not reset valid user data',()=>{
  for(const raw of [null,[],42,{[lin.id]:{...values(),time1:'not a date'}}]) {
    const state=initialState(); state.favorites=[lin.id];state.inviteDrafts=raw;
    const restored=reload(state);
    assert.deepEqual(restored.inviteDrafts,{});
    assert.deepEqual(restored.favorites,[lin.id]);
  }
});
test('a changed skill clears its stale goal while retaining the other lesson and message',()=>{
  const state=initialState();saveInviteDraft(state,lin,{...values(),teach:'吉他',teachGoal:'练习和弦'});
  const restored=readInviteDraft(state,lin);
  assert.equal(restored.teach,'摄影');
  assert.equal(restored.teachGoal,'');
  assert.equal(restored.learnGoal,values().learnGoal);
  assert.equal(restored.note,values().note);
  assert.equal(state.inviteDrafts[lin.id].teachGoal,'练习和弦');
});
test('expired draft dates remain unchanged and fail on the exact field without mutation',()=>{
  const state=initialState();const draft={...values(),time2:'2026-09-21T20:00'};
  saveInviteDraft(state,lin,draft);
  const restored=reload(state);
  assert.equal(readInviteDraft(restored,lin).time2,draft.time2);
  const before=structuredClone(restored);
  assert.throws(()=>createExchange(restored,lin,input(draft),now),error=>error.field==='time2');
  assert.deepEqual(restored,before);
});
test('invitation validation identifies skills, format, goals, dates, order and overlap precisely',()=>{
  const cases=[
    [{teach:'吉他'},'teach'],[{learn:'日语'},'learn'],[{format:'信件'},'format'],
    [{teachGoal:''},'teachGoal'],[{learnGoal:''},'learnGoal'],[{note:''},'note'],
    [{time1:''},'time1'],[{time2:''},'time2'],
    [{time2:'2026-10-20T20:00'},'time2'],
    [{time2:'2026-09-23T19:00'},'time2'],
    [{time2:'2026-09-23T20:30'},'time2'],
  ];
  for(const [changes,field] of cases) {
    const state=initialState(), draft={...values(),...changes};
    saveInviteDraft(state,lin,draft);
    const before=structuredClone(state);
    assert.throws(()=>createExchange(state,lin,input(draft),now),error=>error.field===field,JSON.stringify(changes));
    assert.deepEqual(state,before);
  }
});
test('a conflict in the second lesson points to time2 and preserves the draft',()=>{
  const state=initialState();
  state.exchanges=[{personId:other.id,status:'scheduled',lessons:[{at:'2026-09-24T12:15:00Z',done:false}]}];
  saveInviteDraft(state,lin,values());
  assert.throws(()=>createExchange(state,lin,input(values()),now),error=>error.field==='time2' && /已有其他/.test(error.message));
  assert.equal(state.exchanges.length,1);
  assert.deepEqual(readInviteDraft(state,lin),values());
});
test('successful submission snapshots goals, normalizes dates and clears only the submitted draft',()=>{
  const state=initialState();saveInviteDraft(state,lin,values());saveInviteDraft(state,other,values());
  const e=createExchange(state,lin,input(values()),now);
  assert.equal(e.lessons[0].at,'2026-09-23T12:00:00.000Z');
  assert.equal(e.lessons[0].goal,values().teachGoal);
  assert.equal(readInviteDraft(state,lin),null);
  assert.deepEqual(state.inviteDrafts[other.id],values());
  assert.equal(reload(state).exchanges.length,1);
});
