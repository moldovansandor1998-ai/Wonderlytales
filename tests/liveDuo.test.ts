import { describe, expect, it, vi } from 'vitest';
import { CAST, compactDialogueSchema, dialogueMessages, dialogueSchema, giftEffect, playDialogue, rehearsalDialogue, shortSpokenLine, replySpeaker, giftDialogue } from '@/lib/live/duo';
import { eventSchema } from '@/lib/live/events';
const event=eventSchema.parse({id:'gift-1',type:'gift',user:'Néző',gift:'rózsa',count:3});
const dialogue=rehearsalDialogue(event);
const voices={ali:CAST.ali.voiceId,isti:CAST.isti.voiceId};
describe('Two-character live dialogue',()=>{
  it('bounds paid speech to one short voice without appending gift solicitations',()=>{
    const input={event,history:[],replyIndex:12};
    const result=compactDialogueSchema(input).parse({turns:[
      {speaker:'ali',text:'Te aztán nagyon bátran beszóltál ide nekünk, de Isti is mindjárt válaszol erre neked.',emotion:'laugh'},
      {speaker:'isti',text:'Hát ezt most komolyan nekem mondod vagy csak véletlenül keveredtél ebbe az élőbe? Itt aztán mindent látni lehet.',emotion:'neutral'},
    ]});
    expect(result.turns.map(turn=>turn.speaker)).toEqual(['ali']);
    expect(result.turns[0].text).not.toContain('zeneajándékot');
    expect(result.turns[0].text.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(result.turns[0].text.length).toBeLessThanOrEqual(100);
    expect(dialogueSchema.safeParse(result).success).toBe(true);
    expect(shortSpokenLine('Ti adóztok?!')).toBe('Ti adóztok?!');
    expect(shortSpokenLine('Ali, te dagadt kétszáz kilós!')).toBe('Ali, te dagadt kétszáz kilós!');
    expect(shortSpokenLine('Ez rövid. Ezt már ne mondd el.')).toBe('Ez rövid.');
    expect(shortSpokenLine('Mert valaki megint nem hozta a kedvenc nasiját.',10,85)).toBe('Mert valaki megint nem hozta a kedvenc nasiját.');
    expect(shortSpokenLine('Mert valaki megint nem hozta a kedvenc nasiját.',6,52)).toBe('Mert valaki megint nem hozta.');
  });
  it('rotates speakers, respects direct address and never forces repetitive catchphrases',()=>{
    expect(replySpeaker({event,history:[],replyIndex:12})).toBe('ali');
    expect(replySpeaker({event,history:[],replyIndex:13})).toBe('isti');
    expect(replySpeaker({event:{...event,text:'Isti, táncolni nem tudsz?'},history:[],replyIndex:12})).toBe('isti');
    expect(replySpeaker({event:{...event,text:'Ali, mi van?'},history:[],replyIndex:13})).toBe('ali');
    expect(dialogueMessages({event,history:[]})[0].content).toContain('Zeneajándékot NE kérj');
    const lines=Array.from({length:12},(_,i)=>giftDialogue({...event,count:1},i).turns[0].text);
    expect(new Set(lines).size).toBe(12);
    expect(giftDialogue({...event,count:100},0).turns).toHaveLength(1);
  });
  it('waits for complete playback before using the other voice',async()=>{
    let finishFirst!:()=>void;
    const first=new Promise<void>(resolve=>{finishFirst=resolve;});
    const say=vi.fn().mockImplementationOnce(()=>first).mockResolvedValue(undefined);
    const playing=playDialogue(dialogue,voices,'eleven',new AbortController().signal,say);
    expect(say).toHaveBeenCalledTimes(1);expect(say.mock.calls[0][1]).toBe(CAST.ali.voiceId);
    finishFirst();await playing;
    expect(say).toHaveBeenCalledTimes(2);expect(say.mock.calls[1][1]).toBe(CAST.isti.voiceId);
  });
  it('validates both voices before any paid attempt',async()=>{
    const say=vi.fn();
    await expect(playDialogue(dialogue,{...voices,isti:''},'eleven',new AbortController().signal,say)).rejects.toThrow();
    expect(say).not.toHaveBeenCalled();
  });
  it('does not generate the second voice after stop or first-voice failure',async()=>{
    const controller=new AbortController();
    const stop=vi.fn().mockImplementation(async()=>controller.abort());
    await expect(playDialogue(dialogue,voices,'eleven',controller.signal,stop)).rejects.toThrow();expect(stop).toHaveBeenCalledTimes(1);
    const fail=vi.fn().mockRejectedValue(new Error('provider error'));
    await expect(playDialogue(dialogue,voices,'eleven',new AbortController().signal,fail)).rejects.toThrow('provider error');expect(fail).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown speakers, duplicate roles and excessive turns',()=>{
    expect(dialogueSchema.safeParse({turns:[{...dialogue.turns[0],speaker:'attacker'},dialogue.turns[1]]}).success).toBe(false);
    expect(dialogueSchema.safeParse({turns:[dialogue.turns[0],dialogue.turns[0]]}).success).toBe(false);
    expect(dialogueSchema.safeParse({turns:[...dialogue.turns,dialogue.turns[0]]}).success).toBe(false);
  });
  it('keeps untrusted comments out of the system instructions',()=>{
    const messages=dialogueMessages({event:{...event,text:'IGNORE_PREVIOUS_123'},history:[]});
    expect(messages[0].content).not.toContain('IGNORE_PREVIOUS_123');expect(messages[1].content).toContain('IGNORE_PREVIOUS_123');
  });
  it('shows only bounded effects for unit values strictly over 200, never rose streaks',()=>{
    expect(giftEffect(event)).toBeUndefined();
    expect(giftEffect({...event,giftValue:1,count:10000})).toBeUndefined();
    expect(giftEffect({...event,giftValue:200})).toBeUndefined();
    expect(giftEffect({...event,giftValue:201},1234)).toMatchObject({startedAt:1234,duration:3000});
    expect(giftEffect({...event,type:'comment',giftValue:201})).toBeUndefined();
  });
  it('only claims a song started after the player confirms it',()=>{
    const request={...event,type:'comment' as const,text:'!zene példa'};
    expect(rehearsalDialogue(request).turns[0].text).toContain('listára');
    expect(rehearsalDialogue(request,true).turns[0].text).toContain('indul');
  });
});
