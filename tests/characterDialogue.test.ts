import { beforeEach,expect,it,vi } from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn(),characterVoice:vi.fn()}));
vi.mock('@/lib/config',()=>({isProduction:()=>true}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/lib/providers/translation',()=>({fetchWithTimeout:vi.fn()}));
import { recordCharacterDialogue } from '@/lib/ai-video/dialogue';
import { characterVoice,readCast } from '@/lib/ai-video/voices';
import { fetchWithTimeout } from '@/lib/providers/translation';
import { reserveProductionBudget } from '@/lib/budget';
import { R2VideoStore } from '@/lib/ai-video/storage';
const id='fc68c57c-443f-46d6-a509-4473ce7b0aa9';
const input={characterId:id,expectedVoiceId:'felixVoice',text:'Hűha! Ez aztán közel volt! Mi folyik itt ma?'};
let data:Record<string,unknown>;
const store={readDialogue:async()=>data??null,claimDialogue:async(_id:string,value:Record<string,unknown>)=>{if(data)return false;data=value;return true;},saveDialogue:async(_id:string,value:Record<string,unknown>)=>{data=value;},putDialogueAudio:vi.fn()};
beforeEach(()=>{data=undefined as never;vi.clearAllMocks();process.env.ELEVENLABS_API_KEY='test-secret';vi.mocked(readCast).mockResolvedValue({characters:[{id,name:'Félix',code:'TV_FELIX',voice_id:'row'}],voices:[]});vi.mocked(characterVoice).mockReturnValue({id:'row',character_id:id,voice_id:'felixVoice',provider_voice_id:'felixVoice',language:'hu',provider:'elevenlabs',model:'eleven_v3',status:'USER_SELECTED'});});
it('blocks missing and changed voice assignments before a paid call',async()=>{
 vi.mocked(characterVoice).mockReturnValue(null);
 await expect(recordCharacterDialogue(input,store as unknown as R2VideoStore)).rejects.toThrow('CHARACTER_VOICE_MISSING');
 expect(reserveProductionBudget).not.toHaveBeenCalled();expect(fetchWithTimeout).not.toHaveBeenCalled();
});
it('uses only the assigned voice, caches identical speech, and stores its provenance',async()=>{
 vi.mocked(fetchWithTimeout).mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.alloc(128).toString('base64'),alignment:{characters:['H'],character_start_times_seconds:[0],character_end_times_seconds:[.5]}})));
 const result=await recordCharacterDialogue(input,store as unknown as R2VideoStore);
 expect(result.voiceId).toBe('felixVoice');expect(result.status).toBe('COMPLETED');
 expect(vi.mocked(fetchWithTimeout).mock.calls[0][0]).toContain('/felixVoice/with-timestamps');
 await recordCharacterDialogue(input,store as unknown as R2VideoStore);
 expect(fetchWithTimeout).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);
});
it('retains an uncertain claim so a timeout cannot cause another charge',async()=>{
 vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('timeout'));
 expect((await recordCharacterDialogue(input,store as unknown as R2VideoStore)).status).toBe('UNCERTAIN');
 await recordCharacterDialogue(input,store as unknown as R2VideoStore);expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
});
