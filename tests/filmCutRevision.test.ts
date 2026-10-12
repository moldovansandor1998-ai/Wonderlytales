import {describe,it,expect} from 'vitest';
import {hungarianRevision,revisionCeiling,continuationPlan} from '../src/lib/ai-video/film-cut-revision';
import {makeCutPlan} from '../src/lib/ai-video/film-cut-plan';
import {cutCeiling,independentCutShots,extensionAllowance,type FilmCut} from '../src/lib/ai-video/film-cut-shared';
import {EPISODE_SCENES} from '../src/lib/ai-video/episode-data';
describe('Hungarian revision and next fifteen scenes',()=>{
 it('quotes only the additional allowance and rounds the bound upward',()=>{
  expect(extensionAllowance({authorizedUsd:26.9,chargedUpperUsd:18.341,extension:{ceiling:22.09}} as FilmCut)).toBe(13.54);
  expect(extensionAllowance({authorizedUsd:26.9,chargedUpperUsd:1,extension:{ceiling:22.09}} as FilmCut)).toEqual(0);
 });
 it('keeps originals intact, replaces confusing lines, and motivates the entrance before showing it',()=>{
  const c={shots:makeCutPlan().map((s,i)=>({...s,phase:'READY',asset:'asset'+i,image:'image'+i,lastFrame:'last'+i,seconds:s.seconds||3,...(s.line?{audio:'voice'+i}:{} )}))} as FilmCut;
  const before=structuredClone(c);const shots=hungarianRevision(c);expect(c).toEqual(before);expect(shots).toHaveLength(25);
  expect(shots.find(s=>s.scene===4&&s.line)?.line?.text).toContain('betörés miatt');
  const walk=shots.findIndex(s=>s.scene===12&&s.kind==='action'),entrance=shots.findIndex(s=>s.scene===13);
  expect(walk).toBe(entrance-1);expect(shots[walk-1].line?.text).toBe('Észrevettem.');expect(shots[walk].line?.text).toContain('Tilda segíthet');
  expect(shots[entrance]).toMatchObject({seconds:2.5,trimStart:2.5,remixSource:before.shots.find(s=>s.scene===13)?.asset});
  const parallel=independentCutShots({...c,shots,revision:2,index:0});expect(parallel).toHaveLength(2);for(const i of parallel)expect(shots[i]).toMatchObject({kind:'speech',reframe:false});expect(shots.filter(s=>s.removeNativeSpeech)).toHaveLength(3);expect(revisionCeiling(shots)).toBeLessThan(4);
 });
 it('includes exactly scenes 16 through 30 and every written line once, with a visible courier entrance',()=>{
  const shots=continuationPlan();expect([...new Set(shots.map(s=>s.scene))]).toEqual(Array.from({length:15},(_,i)=>i+16));
  for(let scene=16;scene<=30;scene++)expect(shots.filter(s=>s.scene===scene&&s.line).map(s=>s.line?.text)).toEqual(EPISODE_SCENES[scene].dialogue.map(l=>l.text));
  expect(shots.filter(s=>s.kind==='action')).toHaveLength(5);
  expect(shots.findIndex(s=>s.scene===27&&s.kind==='action')).toBeLessThan(shots.findIndex(s=>s.scene===27&&s.line));
  for(const s of shots.filter(s=>s.frameFrom)){const from=shots.find(x=>x.id===s.frameFrom)!;expect(from.characters).toEqual(s.characters);expect(shots.indexOf(from)).toBeLessThan(shots.indexOf(s));}
  expect(cutCeiling(shots)).toBeLessThan(30);
 });
});
