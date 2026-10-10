import {describe,it,expect} from 'vitest';
import {readAllRows} from '@/lib/db/pagination';
describe('Feature length data pagination',()=>{
 it('loads every dialogue for 400 scenes even under a smaller server cap',async()=>{
  const source=Array.from({length:2400},(_,i)=>({id:String(i).padStart(6,'0'),scene:Math.floor(i/6)}));
  const rows=await readAllRows(async after=>source.filter(r=>!after||r.id>after).slice(0,500));
  expect(rows).toEqual(source);expect(new Set(rows.map(r=>r.scene)).size).toBe(400);
 });
 it('fails instead of looping or silently returning duplicate pages',async()=>{
  await expect(readAllRows(async()=>[{id:'a'}])).rejects.toThrow('did not advance');
 });
});
