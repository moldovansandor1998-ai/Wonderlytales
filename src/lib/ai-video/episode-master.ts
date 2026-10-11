import {join} from 'node:path';
import {R2VideoStore,digest} from './storage';
import {postContext,currentVoices} from './post-core';
import {EPISODE_SCENES} from './episode-data';
import {tempMedia,downloadOwned,concatenate,storeFile} from './post-media';
import {WaveSpeedError} from '../providers/wavespeed';
import type {Language} from './post-shared';
type Master={id:string;language:Language;sourceHash:string;parts:string[];finalAsset?:string;duration:number};
export async function episodeMaster(store:R2VideoStore,language:Language,advance=false){
 const voices=await currentVoices(),scenes=await Promise.all(EPISODE_SCENES.map(s=>postContext(store,s.id,language,voices)));
 const approved=scenes.filter(s=>s.approved).length;if(approved!==scenes.length)return {approved,total:scenes.length,ready:false,parts:0};
 const sources=scenes.map(s=>s.job!.finalAsset!),hash=digest(JSON.stringify(sources)),id=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-');
 const row=await store.readRecord<Master>('episode-master',id);let state:Master=row?.value??{id,language,sourceHash:hash,parts:[],duration:scenes.reduce((s,c)=>s+c.job!.duration,0)};
 if(advance&&!state.finalAsset){
  await tempMedia(async dir=>{
   const start=state.parts.length*10,inputs=start<60?sources.slice(start,start+10):state.parts,files:string[]=[];
   // Bounded sequential downloads keep the function's memory below the whole episode size.
   for(let i=0;i<inputs.length;i++){const file=join(dir,`part-${i}.mp4`);await downloadOwned(await store.assetUrl(inputs[i],'mp4'),file,300*1024*1024);files.push(file);}
   const output=join(dir,'joined.mp4');const durations=start<60?scenes.slice(start,start+10).map(s=>s.job!.duration):state.parts.map((_,i)=>scenes.slice(i*10,i*10+10).reduce((n,s)=>n+s.job!.duration,0));await concatenate(files,output,durations);const asset=await storeFile(store,output,'mp4');
   state=start<60?{...state,parts:[...state.parts,asset]}:{...state,finalAsset:asset};
   if(!await store.writeRecord('episode-master',id,state,row?.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
  });
 }
 return {approved,total:60,ready:true,parts:state.parts.length,finalAsset:state.finalAsset,duration:state.duration};
}
