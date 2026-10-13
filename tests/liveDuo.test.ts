import { describe, expect, it, vi } from 'vitest';
import { CAST, dialogueMessages, dialogueSchema, giftEffect, playDialogue, rehearsalDialogue } from '@/lib/live/duo';
import { eventSchema } from '@/lib/live/events';
const event=eventSchema.parse({id:'gift-1',type:'gift',user:'Néző',gift:'rózsa',count:3});
const dialogue=rehearsalDialogue(event);
const voices={ali:CAST.ali.voiceId,isti:CAST.isti.voiceId};
describe('Two-character live dialogue',()=>{
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
  it('starts bounded gift effects from playback time and maps localized gifts',()=>{
    expect(giftEffect(event,1234)).toMatchObject({kind:'petals',startedAt:1234,duration:7000});
    expect(giftEffect({...event,gift:'Heart Me'},0)?.kind).toBe('hearts');
    expect(giftEffect({...event,gift:'Váratlan'},0)?.kind).toBe('smoke');
    expect(giftEffect({...event,type:'comment'},0)).toBeUndefined();
    expect(dialogue.turns[0].text).toContain('3 rózsa');
  });
  it('only claims a song started after the player confirms it',()=>{
    const request={...event,type:'comment' as const,text:'!zene példa'};
    expect(rehearsalDialogue(request).turns[0].text).toContain('listára');
    expect(rehearsalDialogue(request,true).turns[0].text).toContain('indul');
  });
});
