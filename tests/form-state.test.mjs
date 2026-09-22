import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormDraftStore } from '../src/form-state.mjs';
const text = (name,value='') => ({name,value,type:'text',disabled:false});
const choice = (name,value,checked=false,type='checkbox') => ({name,value,type,checked,disabled:false});
const form = (id,person,fields) => ({id,dataset:{id:person},elements:fields});
const root = (...forms) => ({querySelectorAll:()=>forms});

test('a simulated reply preserves an unfinished message through content replacement',()=>{
  const store=createFormDraftStore();
  store.capture(root(form('message-form','exchange-a',[text('text','我已经准备好素材，还想问…')])));
  const input=text('text');
  store.restore(root(form('message-form','exchange-a',[input])));
  assert.equal(input.value,'我已经准备好素材，还想问…');
});
test('saving a message retains the unfinished review including rating and tags',()=>{
  const store=createFormDraftStore();
  store.capture(root(
    form('review-form','exchange-a',[text('text','讲解清楚，希望下次再练'),choice('rating','4',true,'radio'),choice('rating','5',false,'radio'),choice('tags','耐心友好',true)]),
    form('message-form','exchange-a',[text('text','')]),
  ));
  const review=[text('text'),choice('rating','4',false,'radio'),choice('rating','5',true,'radio'),choice('tags','耐心友好')];
  const message=text('text');
  store.restore(root(form('review-form','exchange-a',review),form('message-form','exchange-a',[message])));
  assert.equal(review[0].value,'讲解清楚，希望下次再练');
  assert.deepEqual(review.slice(1).map(x=>x.checked),[true,false,true]);
  assert.equal(message.value,'');
});
test('returning from another exchange restores only the matching exchange draft',()=>{
  const store=createFormDraftStore();
  store.capture(root(form('message-form','exchange-a',[text('text','第一位伙伴')])));
  const other=text('text');
  store.restore(root(form('message-form','exchange-b',[other])));
  assert.equal(other.value,'');
  store.capture(root(form('message-form','exchange-b',[text('text','第二位伙伴')])));
  const original=text('text');
  store.restore(root(form('message-form','exchange-a',[original])));
  assert.equal(original.value,'第一位伙伴');
});
test('removed or disabled choices are not reintroduced when the agreement changes',()=>{
  const store=createFormDraftStore();
  store.capture(root(form('review-form','exchange-a',[choice('tags','目标达成',true)])));
  const available=choice('tags','耐心友好'),disabled=choice('tags','目标达成');disabled.disabled=true;
  store.restore(root(form('review-form','exchange-a',[available,disabled])));
  assert.equal(available.checked,false);
  assert.equal(disabled.checked,false);
});
test('a cleared submitted message stays empty and resetting drops all unsent contents',()=>{
  const store=createFormDraftStore();
  store.capture(root(form('message-form','exchange-a',[text('text','已发送的内容')])));
  store.capture(root(form('message-form','exchange-a',[text('text','')])));
  const message=text('text');store.restore(root(form('message-form','exchange-a',[message])));
  assert.equal(message.value,'');
  store.capture(root(form('message-form','exchange-a',[text('text','未发送的内容')])));
  store.clear();
  store.restore(root(form('message-form','exchange-a',[message])));
  assert.equal(message.value,'');
});
