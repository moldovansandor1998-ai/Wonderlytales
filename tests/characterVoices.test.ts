import { expect,it } from 'vitest';
import { characterVoice,type CastCharacter,type CastVoice } from '@/lib/ai-video/voices';
const character:CastCharacter={id:'felix',name:'Félix',code:'TV_FELIX',voice_id:'felix-row'};
const voice:CastVoice={id:'felix-row',character_id:'felix',language:'hu',provider:'elevenlabs',voice_id:'felixVoice',provider_voice_id:'felixVoice',model:'eleven_v3',status:'USER_SELECTED'};
it('resolves the selected character voice even when other voices exist',()=>{
 expect(characterVoice(character,[{...voice,id:'old',voice_id:'oldVoice',provider_voice_id:'oldVoice'},voice])?.voice_id).toBe('felixVoice');
});
it('never borrows a different character voice or another language',()=>{
 expect(characterVoice(character,[{...voice,character_id:'mira'}])).toBeNull();
 expect(characterVoice(character,[{...voice,language:'en'}])).toBeNull();
});
it('fails closed for missing, ambiguous or inconsistent assignments',()=>{
 expect(characterVoice(character,[])).toBeNull();
 expect(characterVoice({...character,voice_id:null},[voice,{...voice,id:'other'}])).toBeNull();
 expect(characterVoice(character,[{...voice,provider_voice_id:'miraVoice'}])).toBeNull();
 expect(characterVoice({...character,voice_id:'missing'},[voice])).toBeNull();
});
it('preserves the legacy single exact-character Hungarian assignment',()=>{
 expect(characterVoice({...character,voice_id:null},[voice])?.voice_id).toBe('felixVoice');
});
