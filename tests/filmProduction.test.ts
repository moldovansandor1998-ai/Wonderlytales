import { describe,it,expect } from "vitest";
import { filmProgress,type FilmRun,type FilmTask } from "../src/lib/filmProduction";
describe("film progress does not imply film approval",()=>{
 const r:FilmRun={episode_id:null,title:"fixture",mode:"DIAGNOSTIC",scene_count:1,output_key:null,error:null,created_at:"2026-10-10T00:00:00Z",id:"r",frames:1440,fps:24,status:"REVIEW",quality_report:{production_approved:false}};
 const t=(ordinal:number,status:string,frames=360,kind="RENDER")=>({id:String(ordinal),run_id:"r",ordinal,status,frames,kind}) as FilmTask;
 it("counts rendered seconds once, excluding full-film assembly",()=>{
  const p=filmProgress(r,[t(1,"DONE"),t(2,"DONE"),t(3,"DONE"),t(4,"DONE"),t(5,"DONE",1440,"ASSEMBLY")]);
  expect(p.percent).toBe(100);expect(p.renderedSeconds).toBe(60);expect(p.tasks).toBe(4);expect(p.approved).toBe(false);
 });
 it("does not inflate progress from another film",()=>{
  const p=filmProgress(r,[t(1,"DONE"),{...t(2,"DONE"),run_id:"other"},t(3,"BLOCKED")]);
  expect(p.percent).toBe(25);expect(p.errors).toBe(1);expect(p.approved).toBe(false);
 });
});
