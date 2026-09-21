import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, PEOPLE } from '../data/seed.mjs';
import { partnerAction } from '../src/model.mjs';
import { captureReadingState, restoreReadingState } from '../src/transitions.mjs';
const person = PEOPLE.find(p => p.id === 'lin');

test('partner actions continue each unfinished agreement even after profile changes', () => {
  const state = initialState();
  state.me.active = false;
  state.me.want = ['日语'];
  for (const [status, label] of Object.entries({pending:'查看邀请',scheduled:'继续交换',learning:'继续交换',rescheduling:'安排补课',review:'记录评价'})) {
    state.exchanges = [{id:'existing',personId:person.id,status}];
    assert.deepEqual(partnerAction(state,person),{path:'/exchange/existing',label});
  }
});
test('finished and unrelated agreements do not block a new reciprocal invitation', () => {
  const state = initialState();
  state.exchanges = ['completed','declined','cancelled'].map(status=>({id:status,personId:person.id,status}));
  state.exchanges.unshift({id:'unrelated',personId:'zhou',status:'pending'});
  assert.deepEqual(partnerAction(state,person),{path:'/invite/lin',label:'发起交换'});
  state.me.active = false;
  assert.deepEqual(partnerAction(state,person),{path:'/publish?return=lin',label:'调整供需后交换'});
});
function disclosure(personId, open) {
  return {open,closest:()=>({dataset:{scene:personId}}),querySelector:()=>({textContent:'为什么适合彼此'})};
}
const root = details => ({querySelectorAll:selector=>selector==='details[open]'?details.filter(d=>d.open):details});
test('reading state follows card identity across reordered content and restores closed disclosures', () => {
  const saved=captureReadingState(root([disclosure('lin',true),disclosure('tang',false)]),684);
  const tang=disclosure('tang',true),lin=disclosure('lin',false);
  restoreReadingState(root([tang,lin]),saved);
  assert.equal(saved.scrollY,684);
  assert.equal(lin.open,true);
  assert.equal(tang.open,false);
});
test('missing reading state leaves defaults intact and removed cards are ignored', () => {
  const card=disclosure('tang',true);
  restoreReadingState(root([card]),undefined);
  assert.equal(card.open,true);
  const saved=captureReadingState(root([disclosure('lin',true)]),-10);
  restoreReadingState(root([card]),saved);
  assert.equal(card.open,false);
  assert.equal(saved.scrollY,0);
});
