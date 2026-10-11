import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn().mockResolvedValue({characters:[],voices:[]}),characterVoice:vi.fn().mockReturnValue(null)}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
const calls=vi.hoisted(()=>({submit:vi.fn(),price:vi.fn().mockResolvedValue(.6),balance:vi.fn().mockResolvedValue(10)}));
vi.mock('@/lib/providers/wavespeed',async original=>({...await original<object>(),WaveSpeedClient:class {creativePrice=calls.price;balance=calls.balance;creativeSubmit=calls.submit;}}));
import {postAction} from '@/lib/ai-video/post';
import {fingerprint} from '@/lib/ai-video/post-core';
import {defaultSceneState,EPISODE_SCENES} from '@/lib/ai-video/episode-data';
import {newVersion} from '@/lib/ai-video/post-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
const id=EPISODE_SCENES[3].id,jid='aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa';
function memory(){let seq=0;const map=new Map<string,{value:unknown;etag:string}>();const state={...defaultSceneState(EPISODE_SCENES[3]),dialogue:[],videoJobId:jid},variant={...newVersion(),jobId:jid};const hash=fingerprint(state,variant,'hu',{felix:null,mira:null,nera:null,tilda:null,oszkar:null});for(const [kind,key,value] of [['episode-scene',id,state],['post-scene',id,{id,revision:0,variants:{hu:variant}}],['post-job',jid,{id:jid,sceneId:id,language:'hu',fingerprint:hash,status:'PREPARED',model:'wavespeed-ai/infinitetalk/video-to-video',videoAsset:'a'.repeat(64),speakerAssets:['b'.repeat(64)]}]])map.set(String(kind)+key,{value,etag:String(++seq)});return {readRecord:vi.fn(async(k:string,id:string)=>structuredClone(map.get(k+id)??null)),writeRecord:vi.fn(async(k:string,id:string,v:unknown,etag?:string)=>{if(map.get(k+id)?.etag!==etag)return false;map.set(k+id,{value:structuredClone(v),etag:String(++seq)});return true;}),assetUrl:vi.fn().mockResolvedValue('https://owned.example/media')};}
beforeEach(()=>vi.clearAllMocks());
it('two simultaneous submissions charge the provider only once',async()=>{const store=memory();calls.submit.mockResolvedValue({id:'provider-id',status:'processing'});const r=await Promise.allSettled([1,2].map(()=>postAction({id,language:'hu',action:'start',revision:0,data:{maxCostUsd:.6}},store as unknown as R2VideoStore)));expect(r.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(calls.submit).toHaveBeenCalledTimes(1);});
it('an uncertain provider submission never retries or charges automatically',async()=>{const store=memory();calls.submit.mockRejectedValue(new Error('timeout'));const input={id,language:'hu',action:'start',data:{maxCostUsd:.6}};await postAction(input,store as unknown as R2VideoStore);await expect(postAction(input,store as unknown as R2VideoStore)).rejects.toThrow('PREPARE_REQUIRED');expect(calls.submit).toHaveBeenCalledTimes(1);});
