import {sleep,getWorkflowMetadata} from 'workflow';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {advanceCutBatch,claimCut,pauseCut,readCut} from '@/lib/ai-video/film-cut';
import {cutErrorCode} from '@/lib/ai-video/film-cut-shared';
export async function filmCut(owner:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 if(!await claim(owner,workflowId))return;
 try{for(let i=0;i<1800;i++){const result=await advance(owner,workflowId);if(result.done)return;await sleep(result.progress?'1s':'15s');}await pause(owner,workflowId,'CUT_TIMEOUT');}
 catch(e){await pause(owner,workflowId,cutErrorCode(e));}
}
async function claim(owner:string,workflowId:string){
 'use step';
 return claimCut(new R2VideoStore(owner),workflowId);}
async function advance(owner:string,workflowId:string){
 'use step';
 const store=new R2VideoStore(owner);
 const before=await readCut(store);
 try{const done=await advanceCutBatch(store,workflowId),after=await readCut(store);return {done,progress:before?.updatedAt!==after?.updatedAt};}
 catch(e){await pauseCut(store,workflowId,cutErrorCode(e));return {done:true,progress:false};}}
async function pause(owner:string,workflowId:string,error:string){
 'use step';
 await pauseCut(new R2VideoStore(owner),workflowId,error);}
