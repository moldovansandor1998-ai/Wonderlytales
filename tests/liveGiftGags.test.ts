import {describe,it,expect} from "vitest";
import {BASIC_GAGS,GAG_META,GiftGagPicker,isGalaxyGift,availableGiftGag} from "@/lib/live/npc-shared";
import {EventQueue,eventSchema} from "@/lib/live/events";
const gift=eventSchema.parse({id:"g",type:"gift",user:"Peti",gift:"Próba",giftValue:200,count:1});
describe("Gift choreography",()=>{
 it("gives 10–199 the begging scene and all six gags without repeats from 200 to 999",()=>{
  const picker=new GiftGagPicker(()=>0.2);
  expect(picker.pick({...gift,giftValue:9,count:10000})).toBeUndefined();
  for(const value of [10,100,199])expect(picker.pick({...gift,giftValue:value})).toBe("gag-beg");
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
 it("never merges a 10-point scene into a rose batch or waits eight seconds between gifts",()=>{
  const queue=new EventQueue({coalesceGifts:true});
  queue.add({...gift,id:'rose',giftValue:1});queue.add({...gift,id:'beg',giftValue:10});
  expect(queue.takeGift()).toMatchObject({id:'rose',giftValue:1,count:1});
  expect(queue.takeGift()).toMatchObject({id:'beg',giftValue:10,count:1});
  queue.add({...gift,id:'comment',type:'comment'});expect(queue.takeGift()).toBeUndefined();
  expect(queue.take()?.id).toBe('comment');
 });
 it("plays saved alternatives when premium generation is blocked, keeping Galaxy exclusive",()=>{
  const saved=Object.fromEntries([...BASIC_GAGS,"gag-galaxy","gag-tornado"].map(kind=>[kind,"saved.mp4"]));
  for(const kind of BASIC_GAGS)expect(availableGiftGag(kind,saved)).toBe(kind);
  expect(availableGiftGag("gag-galaxy",saved)).toBe("gag-galaxy");
  for(const kind of ["gag-bubble","gag-rocket","gag-meteor"] as const)expect(availableGiftGag(kind,saved)).toBe("gag-tornado");
  expect(availableGiftGag("gag-rocket",{"gag-galaxy":"saved.mp4"})).toBeUndefined();
  expect(availableGiftGag("gag-galaxy",{"gag-tornado":"saved.mp4"})).toBeUndefined();
  expect(availableGiftGag("gag-beg",saved)).toBeUndefined();
  expect(availableGiftGag("gag-beg",{"gag-beg":"beg.mp4"})).toBe("gag-beg");
  expect(availableGiftGag(undefined,saved)).toBeUndefined();
 });
});
