import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent} from './normalize.mjs';
test('reads nested user and gift fields used by connector v2',()=>{const e=normalizeEvent('gift',{common:{msgId:'1'},user:{nickname:'Teszt'},giftDetails:{giftType:1,giftName:'Rose'},repeatEnd:true,repeatCount:5});assert.equal(e.user,'Teszt');assert.equal(e.count,5);assert.equal(e.gift,'Rose');});
test('does not duplicate in-progress gift streaks',()=>assert.equal(normalizeEvent('gift',{giftDetails:{giftType:1},repeatEnd:false}),null));
test('normalizes stable replay IDs and ignores empty comments',()=>{assert.equal(normalizeEvent('comment',{common:{msgId:'abc'},comment:'szia'}).id,'comment:abc');assert.equal(normalizeEvent('comment',{comment:' '}),null);});
