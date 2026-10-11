import {sleep,getWorkflowMetadata} from 'workflow';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {advanceAutomatic,claimAutomatic,pauseAutomatic} from '@/lib/ai-video/automatic';

export async function finishedVideo(owner:string,id:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 if(!await claim(owner,id,workflowId))return;
 try{
  for(let i=0;i<480;i++){
   if(await advance(owner,id,workflowId))return;
   await sleep('15s');
  }
  await pause(owner,id,workflowId,'AUTO_TIMEOUT');
 }catch(e){await pause(owner,id,workflowId,e instanceof Error?e.message:'AUTO_PROVIDER_FAILED');}
}
async function claim(owner:string,id:string,workflowId:string){
 'use step';
 return claimAutomatic(new R2VideoStore(owner),id,workflowId);
}
async function advance(owner:string,id:string,workflowId:string){
 'use step';
 return advanceAutomatic(new R2VideoStore(owner),id,workflowId);
}
async function pause(owner:string,id:string,workflowId:string,error:string){
 'use step';
 await pauseAutomatic(new R2VideoStore(owner),id,workflowId,error);
}
