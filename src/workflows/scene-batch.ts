import {sleep,getWorkflowMetadata} from 'workflow';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {advanceBatch,claimBatch,updateBatch} from '@/lib/ai-video/batch';
export async function sceneBatch(owner:string,id:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 if(!await claim(owner,id,workflowId))return;
 try{for(let i=0;i<1200;i++){if(await advance(owner,id,workflowId))return;await sleep('20s');}await pause(owner,id,workflowId,'AUTO_TIMEOUT');}
 catch(e){await pause(owner,id,workflowId,e instanceof Error?e.message:'AUTO_PROVIDER_FAILED');}
}
async function claim(owner:string,id:string,workflowId:string){'use step';console.info('Wonderly batch claim',id);return claimBatch(new R2VideoStore(owner),id,workflowId);}
async function advance(owner:string,id:string,workflowId:string){'use step';return advanceBatch(new R2VideoStore(owner),id,workflowId);}
async function pause(owner:string,id:string,workflowId:string,error:string){'use step';console.info('Wonderly batch paused',id,error);await updateBatch(new R2VideoStore(owner),id,{status:'PAUSED',error:/^[A-Z_]+$/.test(error)?error:'AUTO_PROVIDER_FAILED'},workflowId);}
