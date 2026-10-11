import {afterEach,expect,it,vi} from 'vitest';
import {matchingElementRequests} from '@/lib/ai-video/element-recovery';
import {WaveSpeedClient} from '@/lib/providers/wavespeed';
const image='https://store.test/bucket/owner/images/'+'a'.repeat(64);
const task={id:'mira-task',model:'kwaivgi/kling-elements',status:'completed' as const,inputs:{name:'Mira',image:image+'?signature=old'}};
afterEach(()=>vi.unstubAllGlobals());
it('only recovers an element with this exact owner image and character, ignoring expired signatures',()=>{
 expect(matchingElementRequests([task],'Mira',image+'?signature=new')).toEqual([task]);
 for(const other of [
  {...task,inputs:{...task.inputs,image:image.replace('/owner/','/other-owner/')}},
  {...task,inputs:{...task.inputs,image:image.replace('store.test','foreign.test')}},
  {...task,inputs:{...task.inputs,name:'Félix'}},
  {...task,model:'another-model'},
  {...task,inputs:undefined},
 ])expect(matchingElementRequests([other],'Mira',image)).toEqual([]);
});
it('accepts a provider null error and pending null outputs without losing a paid request id',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:200,data:{id:'already-paid',status:'processing',outputs:null,error:null}}),{status:200})));
 expect(await new WaveSpeedClient('test-key').creativeSubmit('kwaivgi/kling-elements',{})).toMatchObject({id:'already-paid',status:'processing'});
});
it('preserves a provider id even when the rest of its response has an unsupported shape',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:200,data:{id:'already-paid',status:'unexpected',outputs:null}}),{status:200})));
 await expect(new WaveSpeedClient('test-key').creativeSubmit('kwaivgi/kling-elements',{})).rejects.toMatchObject({code:'PROVIDER_RESPONSE_REVIEW_REQUIRED',taskId:'already-paid'});
});
