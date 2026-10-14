import {describe,it,expect} from "vitest";
import {TikTokRecovery} from "@/lib/live/tiktok-recovery";

describe("bounded recovery after a known TikTok suspension",()=>{
  it("never retries initial offline, auth, signer, rate-limit or actual stream end",()=>{
    const recovery=new TikTokRecovery();
    expect(recovery.retryStatus("TIKTOK_OFFLINE")).toBe(false);
    expect(recovery.delay(1000,true)).toBeNull();
    recovery.suspended();
    for(const code of ["TIKTOK_ENDED","TIKTOK_RATE_LIMIT","TIKTOK_SIGN_SERVICE","UNAUTHORIZED"])expect(recovery.retryStatus(code)).toBe(false);
  });
  it("retries temporary offline during suspension and resets only after successful connection",()=>{
    const recovery=new TikTokRecovery();recovery.suspended();
    expect(recovery.delay(1012,true)).toBe(5000);
    expect(recovery.retryStatus("TIKTOK_OFFLINE")).toBe(true);
    expect(recovery.delay(1000,true,true)).toBe(10000);
    recovery.connected();expect(recovery.retryStatus("TIKTOK_OFFLINE")).toBe(false);
    expect(recovery.delay(1012,true)).toBe(5000);
  });
  it("bounds attempts and the suspension recovery window",()=>{
    let now=1000;const recovery=new TikTokRecovery(()=>now);recovery.suspended();
    for(let i=0;i<6;i++)expect(recovery.delay(1012,true)).not.toBeNull();
    expect(recovery.retryStatus("TIKTOK_OFFLINE")).toBe(false);expect(recovery.delay(1012,true)).toBeNull();
    recovery.connected();recovery.suspended();now+=120001;
    expect(recovery.retryStatus("TIKTOK_TIMEOUT")).toBe(false);expect(recovery.delay(1012,true)).toBeNull();
  });
});
