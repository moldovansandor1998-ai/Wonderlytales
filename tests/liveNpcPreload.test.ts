import {afterEach,describe,it,expect,vi} from "vitest";
// Do not render again: playback from the initial async callback must see the preload.
vi.mock("react",()=>({useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>[value,vi.fn()],useEffect:vi.fn()}));
import {useNpc} from "@/app/live-studio/useNpc";
import {GiftGagPicker,availableGiftGag} from "@/lib/live/npc-shared";
describe("NPC assets before the next React render",()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it("makes both the first small-gift clip and cached voice immediately available after ensure",async()=>{
  const clips=["idle-breathe","idle-glance","idle-shrug","music-gift","gag-beg"].map(kind=>({kind,status:"SUCCEEDED",url:`/assets/${kind}`}));
  const manifest={clips,voice:{status:"SUCCEEDED",url:"/assets/shout"},begVoice:{status:"SUCCEEDED",url:"/assets/beg-voice"},ready:true};
  const fetcher=vi.fn(async(url:string)=>url.startsWith("/api/")?Response.json(manifest):new Response(new Uint8Array(200)));
  vi.stubGlobal("fetch",fetcher);
  const npc=useNpc();expect(npc.currentAssets()).toBeUndefined();
  const assets=await npc.ensure("IstiVoice",new AbortController().signal);
  expect(npc.assets).toBeUndefined(); // The async closure still holds the initial render.
  expect(npc.currentAssets()).toBe(assets);expect(npc.currentAssets()?.begVoice).toMatch(/^blob:/);
  const requested=new GiftGagPicker().pick({id:"g",type:"gift",user:"Peti",text:"",giftValue:10,count:1});
  expect(availableGiftGag(requested,npc.currentAssets()?.gags)).toBe("gag-beg");
  const previousCalls=fetcher.mock.calls.length;
  expect(await npc.ensure("IstiVoice",new AbortController().signal)).toBe(assets);expect(fetcher.mock.calls.length).toBe(previousCalls);
  [assets.voice,assets.begVoice,assets.reaction,...assets.idle,...Object.values(assets.gags||{})].forEach(url=>{if(url)URL.revokeObjectURL(url);});
 });
});
