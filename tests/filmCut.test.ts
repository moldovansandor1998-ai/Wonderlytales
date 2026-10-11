import {describe,it,expect} from 'vitest';
import {makeCutPlan} from '../src/lib/ai-video/film-cut-plan';
import {cutCeiling,speechDuration,chargeAllowed,cutErrorCode,independentCutShots,type FilmCut} from '../src/lib/ai-video/film-cut-shared';
import {parseCutCheck} from '../src/lib/ai-video/film-cut';
import {EPISODE_SCENES} from '../src/lib/ai-video/episode-data';
describe('speech-led preview through scene 15',()=>{
 it('runs ahead only on approved fixed cameras, with at most two independent clips',()=>{
  const shots=makeCutPlan(),source=shots.find(s=>s.label==='Mira megállítja Félixet')!;
  const c={shots,index:5} as FilmCut;source.image='verified-camera';
  expect(independentCutShots(c)).toEqual([]);source.phase='READY';
  const ready=independentCutShots(c);expect(ready).toHaveLength(2);
  for(const i of ready){expect(i).toBeGreaterThan(c.index);expect(shots[i].frameFrom).toBe(source.id);expect(shots[i].kind).toBe('speech');}
  shots[ready[0]].cleaned='complete';expect(independentCutShots(c)).not.toContain(ready[0]);
  source.phase='CHECK';expect(independentCutShots(c)).toEqual([]);
 });
 it('keeps deliberate review errors across workflow serialization without leaking arbitrary messages',()=>{
  expect(cutErrorCode({message:'CUT_VISUAL_REVIEW_REQUIRED'})).toBe('CUT_VISUAL_REVIEW_REQUIRED');
  expect(cutErrorCode({code:'WAVESPEED_BALANCE_LOW',message:'request details'})).toBe('WAVESPEED_BALANCE_LOW');
  expect(cutErrorCode({message:'secret request URL'})).toBe('CUT_PROCESSING_FAILED');
 });
 it('includes every line once, preserves the intro and the first two scenes, and ends at 15',()=>{
  const shots=makeCutPlan();expect(shots.slice(0,3).map(s=>[s.scene,s.kind])).toEqual([[0,'reuse'],[1,'reuse'],[2,'reuse']]);
  expect(shots.at(-1)?.scene).toBe(15);expect(shots.some(s=>s.scene>15)).toBe(false);
  for(let n=3;n<=15;n++)expect(shots.filter(s=>s.scene===n&&s.line).map(s=>s.line)).toEqual(EPISODE_SCENES[n].dialogue);
  expect(shots.filter(s=>s.kind==='speech').every(s=>s.characters.length===1&&s.characters[0]===s.line?.character)).toBe(true);
  expect(shots.filter(s=>s.frameFrom)).toHaveLength(6);
  for(const s of shots.filter(s=>s.frameFrom)){const source=shots.find(x=>x.id===s.frameFrom)!;expect(source.characters).toEqual(s.characters);expect(shots.indexOf(source)).toBeLessThan(shots.indexOf(s));expect(s.reframe).toBe(false);}
  expect(shots.filter(s=>s.kind==='action').map(s=>s.seconds)).toEqual([4,4,4,3,5]);
  expect(shots.find(s=>s.scene===9&&s.kind==='action')?.line?.delivery).toBe('offscreen');
 });
 it('prices all paid work conservatively, deducting already recorded voices',()=>{
  const shots=makeCutPlan(),full=cutCeiling(shots);expect(full).toBeGreaterThan(25);
  const ready=shots.map(s=>s.line?{...s,recording:'cached'}:s);
  expect(cutCeiling(ready)).toBeLessThan(30);expect(cutCeiling(ready)).toBeCloseTo(full-shots.filter(s=>s.line).length*.25,2);
 });
 it('protects entire speech including lead and tail, and rejects a clip that would truncate it',()=>{
  expect(speechDuration(3.082449)).toBeGreaterThanOrEqual(3.082449+.55);
  expect(speechDuration(3.082449)).toBeLessThan(4);
  expect(speechDuration(.5)).toBe(2);
  expect(()=>speechDuration(9.6)).toThrow('CUT_SPEECH_TOO_LONG');
  expect(()=>speechDuration(NaN)).toThrow();
 });
 it('requires a reserved active run, per-job limit and remaining approved total',()=>{
  const c={budget:'RESERVED',status:'RUNNING',authorizedUsd:5,chargedUpperUsd:4.5} as FilmCut;
  expect(chargeAllowed(c,.5,.5)).toBe(true);expect(chargeAllowed(c,.51,.6)).toBe(false);
  expect(chargeAllowed(c,.2,.1)).toBe(false);expect(chargeAllowed({...c,status:'STOPPED'},.1,.1)).toBe(false);
  expect(chargeAllowed({...c,budget:'NONE'},.1,.1)).toBe(false);expect(chargeAllowed(c,NaN,1)).toBe(false);
 });
 it('fails closed when the visual check is malformed or reports captions',()=>{
  const check={text_overlay:false,unexpected_character:false,teleportation:false,identity_change:false,reason:'Rendben'};
  expect(parseCutCheck(JSON.stringify(check)).passed).toBe(true);
  expect(parseCutCheck(JSON.stringify({...check,text_overlay:true})).passed).toBe(false);
  expect(parseCutCheck('looks good')).toEqual({passed:false,text:'looks good'});
 });
});
