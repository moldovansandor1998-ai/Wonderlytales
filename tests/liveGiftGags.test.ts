import {describe,it,expect} from "vitest";
import {BASIC_GAGS,GAG_META,GiftGagPicker,isGalaxyGift} from "@/lib/live/npc-shared";
import {EventQueue,eventSchema} from "@/lib/live/events";
const gift=eventSchema.parse({id:"g",type:"gift",user:"Peti",gift:"Próba",giftValue:200,count:1});
describe("Gift choreography",()=>{
 it("gives 199 only speech, but all six gags without repeats from 200 to 999",()=>{
  const picker=new GiftGagPicker(()=>0.2);
  expect(picker.pick({...gift,giftValue:199,count:10000})).toBeUndefined();
  const first=Array.from({length:6},()=>picker.pick(gift)!);
  expect(new Set(first)).toEqual(new Set(BASIC_GAGS));
  const next=picker.pick({...gift,giftValue:999});expect(next).not.toBe(first[5]);
  const second=[next,...Array.from({length:5},()=>picker.pick(gift))];expect(new Set(second).size).toBe(6);
 });
 it("routes exact Galaxy gifts to the kick, never comments or similar names",()=>{
  const picker=new GiftGagPicker();
  expect(picker.pick({...gift,gift:'Galaxis',giftValue:1000})).toBe('gag-galaxy');
  expect(picker.pick({...gift,gift:'Galaxy',giftValue:1000})).toBe('gag-galaxy');
  expect(isGalaxyGift({...gift,gift:'Tiny Galaxy'})).toBe(false);
  expect(picker.pick({...gift,type:'comment',gift:'Galaxy'})).toBeUndefined();
  expect(isGalaxyGift({...gift,gift:'Galaxie',giftId:'123'},'123')).toBe(true);
 });
 it("keeps larger gifts stable by ID and scales to five then six seconds",()=>{
  const picker=new GiftGagPicker();
  for(const value of [1000,4999,5000,99999]){const event={...gift,giftId:'12345',giftValue:value};const selected=picker.pick(event)!;expect(picker.pick(event)).toBe(selected);expect(GAG_META[selected].playbackSeconds).toBe(value<5000?5:6);}
 });
 it("preserves named senders in small gift batches and separates distinct large donors",()=>{
  const queue=new EventQueue({coalesceGifts:true});
  queue.add({...gift,id:'a',user:'Peti',giftValue:1});queue.add({...gift,id:'b',user:'Anna',giftValue:1});
  expect(queue.take()).toMatchObject({count:2,user:'Peti',contributors:['Peti','Anna']});
  queue.add({...gift,id:'c',user:'Peti'});queue.add({...gift,id:'d',user:'Anna'});
  expect(queue.size).toBe(2);expect(queue.take()?.user).toBe('Peti');expect(queue.take()?.user).toBe('Anna');
 });
});
