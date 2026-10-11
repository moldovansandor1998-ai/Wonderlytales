import {sleep,getWorkflowMetadata} from 'workflow';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {advanceCut,claimCut,pauseCut} from '@/lib/ai-video/film-cut';
export async function filmCut(owner:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 if(!await claim(owner,workflowId))return;
 try{for(let i=0;i<1800;i++){if(await advance(owner,workflowId))return;await sleep('15s');}await pause(owner,workflowId,'CUT_TIMEOUT');}
 catch(e){await pause(owner,workflowId,e instanceof Error?e.message:'CUT_PROCESSING_FAILED');}
}
async function claim(owner:string,workflowId:string){
 'use step';
 return claimCut(new R2VideoStore(owner),workflowId);}
async function advance(owner:string,workflowId:string){
 'use step';
 return advanceCut(new R2VideoStore(owner),workflowId);}
async function pause(owner:string,workflowId:string,error:string){
 'use step';
 await pauseCut(new R2VideoStore(owner),workflowId,error);}
