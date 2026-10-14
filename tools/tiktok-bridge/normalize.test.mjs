import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent,createEventNormalizer} from './normalize.mjs';
test('reads nested user and gift fields used by connector v2',()=>{const e=normalizeEvent('gift',{common:{msgId:'1'},user:{nickname:'Teszt'},giftDetails:{giftType:1,giftName:'Rose'},repeatEnd:true,repeatCount:5});assert.equal(e.user,'Teszt');assert.equal(e.count,5);assert.equal(e.gift,'Rose');});
test('does not duplicate in-progress gift streaks',()=>assert.equal(normalizeEvent('gift',{giftDetails:{giftType:1},repeatEnd:false}),null));
test('normalizes stable replay IDs and ignores empty comments',()=>{assert.equal(normalizeEvent('comment',{common:{msgId:'abc'},comment:'szia'}).id,'comment:abc');assert.equal(normalizeEvent('comment',{comment:' '}),null);});
test('reacts to a known streak immediately, ignores its updates/end, and permits a new group',()=>{
  const normalize=createEventNormalizer();
  const data={groupId:'123',common:{msgId:'first'},giftId:9,gift:{type:1,name:'Small gift',diamondCount:10},user:{id:'user-1',nickname:'Peti'},repeatEnd:0,repeatCount:1};
  const first=normalize('gift',data);assert.equal(first.giftValue,10);assert.equal(first.count,1);
  assert.equal(normalize('gift',{...data,common:{msgId:'tick'},repeatCount:2}),null);
  assert.equal(normalize('gift',{...data,common:{msgId:'end'},repeatEnd:1,repeatCount:2}),null);
  assert.notEqual(normalize('gift',{...data,groupId:'124'}).id,first.id);
  assert.notEqual(normalize('gift',{...data,user:{id:'user-2',nickname:'Anna'}}).id,first.id);
  assert.equal(createEventNormalizer()('gift',data).id,first.id);
});
test('keeps safe final-event fallback for missing IDs and forwards non-streak events',()=>{
  const normalize=createEventNormalizer();
  for(const data of [{groupId:'0',user:{id:'u'}},{groupId:'123',user:{nickname:'Peti'}},{groupId:undefined,user:{id:'u'}}]){
    assert.equal(normalize('gift',{...data,gift:{type:1},repeatEnd:0}),null);
    assert.ok(normalize('gift',{...data,gift:{type:1},repeatEnd:1}));
  }
  assert.ok(normalize('gift',{gift:{type:0},repeatEnd:0}));
  assert.equal(normalize('comment',{comment:'Szia!',msgId:'c'}).text,'Szia!');
});
