import {describe,expect,it} from "vitest";
import {WebcastChatMessage,WebcastGiftMessage,CommonMessageData,User,Gift} from "tiktok-live-proto/v3";
import {normalizeEvent} from "../tools/tiktok-bridge/normalize.mjs";
import {eventSchema,EventQueue} from "@/lib/live/events";
import {giftEffect} from "@/lib/live/duo";

describe("installed TikTok connector v3 wire payloads",()=>{
  it("delivers the actual decoded comment to the reply queue",()=>{
    const packet=WebcastChatMessage.encode(Object.assign(WebcastChatMessage.decode(new Uint8Array()),{common:Object.assign(CommonMessageData.decode(new Uint8Array()),{msgId:"1234567890123456789"}),user:Object.assign(User.decode(new Uint8Array()),{nickname:"Tesztelő",displayId:"studio_viewer"}),content:"Ali, miért duzzog Isti?"})).finish();
    const decoded=WebcastChatMessage.decode(packet);
    const event=eventSchema.parse(normalizeEvent("comment",decoded));
    const queue=new EventQueue();expect(queue.add(event)).toBe(true);
    expect(queue.take()).toMatchObject({id:"comment:1234567890123456789",user:"Tesztelő",text:"Ali, miért duzzog Isti?"});
    expect(queue.add(event)).toBe(false);
  });
  it("waits for a native gift streak to finish and preserves its name and count",()=>{
    const gift=Object.assign(WebcastGiftMessage.decode(new Uint8Array()),{common:Object.assign(CommonMessageData.decode(new Uint8Array()),{msgId:"1234567890123456790"}),user:Object.assign(User.decode(new Uint8Array()),{nickname:"Tesztelő"}),gift:Object.assign(Gift.decode(new Uint8Array()),{type:1,name:"Rose",diamondCount:1}),repeatEnd:0,repeatCount:3});
    expect(normalizeEvent("gift",WebcastGiftMessage.decode(WebcastGiftMessage.encode(gift).finish()))).toBeNull();
    gift.repeatEnd=1;
    const event=eventSchema.parse(normalizeEvent("gift",WebcastGiftMessage.decode(WebcastGiftMessage.encode(gift).finish())));
    expect(event).toMatchObject({gift:"Rose",count:3});expect(event.giftValue).toBe(1);expect(giftEffect(event)).toBeUndefined();
  });
  it("preserves the real unit price from a decoded expensive gift",()=>{
    const message=Object.assign(WebcastGiftMessage.decode(new Uint8Array()),{common:Object.assign(CommonMessageData.decode(new Uint8Array()),{msgId:"8877"}),gift:Object.assign(Gift.decode(new Uint8Array()),{name:"Big gift",diamondCount:201}),repeatEnd:1,repeatCount:1,user:Object.assign(User.decode(new Uint8Array()),{nickname:"Teszt"})});
    const event=eventSchema.parse(normalizeEvent("gift",WebcastGiftMessage.decode(WebcastGiftMessage.encode(message).finish())));
    expect(event.giftValue).toBe(201);expect(giftEffect(event)?.duration).toBe(4000);
  });
  it("uses the current displayId when no nickname is provided",()=>{
    const message=Object.assign(WebcastChatMessage.decode(new Uint8Array()),{content:"Szia",user:Object.assign(User.decode(new Uint8Array()),{displayId:"viewer_handle"})});
    expect(normalizeEvent("comment",message)?.user).toBe("viewer_handle");
  });
});
