import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),owners:vi.fn()}));
vi.mock("@/lib/ai-video/storage",()=>({R2VideoStore:class {constructor(owner:string){state.owners(owner);}readRecord=state.read;writeRecord=state.write;}}));
import {claimTikTokSession} from "@/lib/live/tiktok-session";
describe("owner-scoped TikTok lease",()=>{
  beforeEach(()=>{vi.clearAllMocks();state.read.mockResolvedValue(null);state.write.mockResolvedValue(true);});
  it("does not claim an active or cooling-down lease",async()=>{state.read.mockResolvedValue({etag:"one",value:{token:"a",expiresAt:Date.now()+1000,lastAttempt:0}});expect(await claimTikTokSession("owner")).toBeNull();expect(state.write).not.toHaveBeenCalled();});
  it("uses conditional create and loses concurrent claims safely",async()=>{state.write.mockResolvedValue(false);expect(await claimTikTokSession("owner")).toBeNull();expect(state.owners).toHaveBeenCalledWith("owner");expect(state.write.mock.calls[0][3]).toBeUndefined();});
  it("does not release another connection that has replaced it",async()=>{const release=await claimTikTokSession("owner");expect(release).not.toBeNull();state.read.mockResolvedValue({etag:"new",value:{token:"other",expiresAt:1,lastAttempt:0}});await release!();expect(state.write).toHaveBeenCalledOnce();});
  it("releases its own lease using the current etag",async()=>{const release=await claimTikTokSession("owner");const lease=state.write.mock.calls[0][2];state.read.mockResolvedValue({etag:"own",value:lease});await release!();expect(state.write.mock.calls[1][2]).toEqual({...lease,expiresAt:0});expect(state.write.mock.calls[1][3]).toBe("own");});
});
