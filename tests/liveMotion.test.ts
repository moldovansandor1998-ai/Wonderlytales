import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {reserveProductionBudget} from '@/lib/budget';
import {pcmWave,prepareMotion,createMotion,retrieveMotion} from '@/lib/live/motion';
const id='baa672bd-4424-4732-ad14-55eb52bc81f7';
const fetchMock=vi.fn();
describe('Comment-driven Runway videos',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);vi.stubEnv('RUNWAYML_API_SECRET','test');vi.stubEnv('ELEVENLABS_API_KEY','test');vi.stubEnv('RUNWAY_AVATAR_ID',id);});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it('bounds exact PCM duration and rejects malformed audio before video billing',()=>{
  const wav=pcmWave(Buffer.alloc(960000).toString('base64'));
  expect(wav.toString('ascii',0,4)).toBe('RIFF');expect(wav.readUInt32LE(40)).toBe(960000);expect(wav.readUInt32LE(24)).toBe(16000);
  expect(()=>pcmWave(Buffer.alloc(960002).toString('base64'))).toThrow('MOTION_AUDIO_TOO_LONG');
  expect(()=>pcmWave('not audio!')).toThrow('VOICE_PROVIDER_ERROR');
 });
 it('does not reserve or spend on an unready character',async()=>{
  fetchMock.mockResolvedValue(new Response(JSON.stringify({status:'PROCESSING'})));
  await expect(prepareMotion('isti')).rejects.toThrow('RUNWAY_CHARACTER_NOT_READY');expect(reserveProductionBudget).not.toHaveBeenCalled();
 });
 it('reserves the bounded price and posts original audio exactly once',async()=>{
  fetchMock.mockResolvedValue(new Response(JSON.stringify({id})));
  await expect(createMotion(id,Buffer.from('wave'))).resolves.toBe(id);
  expect(reserveProductionBudget).toHaveBeenCalledWith('runway_reply_30s');expect(fetchMock).toHaveBeenCalledTimes(1);
  const body=JSON.parse(fetchMock.mock.calls[0][1].body);expect(body.speech).toEqual({type:'audio',audio:'data:audio/wav;base64,d2F2ZQ=='});
 });
 it('fails closed when the budget cannot be reserved',async()=>{
  vi.mocked(reserveProductionBudget).mockRejectedValueOnce(new Error('budget'));
  await expect(createMotion(id,Buffer.from('wave'))).rejects.toThrow('budget');expect(fetchMock).not.toHaveBeenCalled();
 });
 it('does not retry credit failures and rejects unsafe output URLs',async()=>{
  fetchMock.mockResolvedValueOnce(new Response('{}',{status:402}));
  await expect(createMotion(id,Buffer.from('wave'))).rejects.toThrow('RUNWAY_CREDITS_REQUIRED');expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({status:'SUCCEEDED',output:['javascript:alert(1)']})));
  await expect(retrieveMotion(id)).rejects.toThrow('MOTION_INVALID_VIDEO');
 });
});
