import {getWorkflowMetadata,sleep} from 'workflow';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {claimBatch,advanceBatch,pauseBatch} from '@/lib/ai-video/batch';
export async function sceneBatch(owner:string,id:string){
 'use workflow';
 const workflowId=getWorkflowMetadata().workflowRunId;
 if(!await claim(owner,id,workflowId))return;
 try{for(let i=0;i<4800;i++){if(await advance(owner,id,workflowId))return;await sleep('15s');}await pause(owner,id,workflowId,'AUTO_TIMEOUT');}
 catch(e){await pause(owner,id,workflowId,e instanceof Error?e.message:'AUTO_PROVIDER_FAILED');}
}
async function claim(owner:string,id:string,w:string){'use step';return claimBatch(new R2VideoStore(owner),id,w);}
async function advance(owner:string,id:string,w:string){'use step';return advanceBatch(new R2VideoStore(owner),id,w);}
async function pause(owner:string,id:string,w:string,error:string){'use step';await pauseBatch(new R2VideoStore(owner),id,w,error);}
