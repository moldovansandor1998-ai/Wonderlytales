import { isBigGift, type LiveEvent } from "./events";

export const NPC_IMAGE = "/live-studio/ali-isti-masked.webp";
export const BASIC_GAGS = ["gag-mud", "gag-cream", "gag-pie", "gag-slime", "gag-spin", "gag-confetti"] as const;
export const GAG_KINDS = [...BASIC_GAGS, "gag-galaxy", "gag-tornado", "gag-bubble", "gag-rocket", "gag-meteor"] as const;
export type GagKind = typeof GAG_KINDS[number];
export const NPC_KINDS = ["idle-breathe", "idle-glance", "idle-shrug", "music-gift", ...GAG_KINDS] as const;
export type NpcKind = typeof NPC_KINDS[number];
export const GAG_META: Record<GagKind, {label:string; duration:4|6; playbackSeconds:number; impact:number}> = {
  "gag-mud": {label:"Habkakás tál",duration:4,playbackSeconds:4,impact:1.25},
  "gag-cream": {label:"Dupla tejszínhab",duration:4,playbackSeconds:4,impact:0.8},
  "gag-pie": {label:"Óriáspite",duration:4,playbackSeconds:4,impact:1.3},
  "gag-slime": {label:"Nyálkavödör",duration:4,playbackSeconds:4,impact:1.2},
  "gag-spin": {label:"Pörgő szék",duration:4,playbackSeconds:4,impact:0.7},
  "gag-confetti": {label:"Konfettiágyú",duration:4,playbackSeconds:4,impact:1},
  "gag-galaxy": {label:"Galaxis – Pista a Holdra megy",duration:6,playbackSeconds:6,impact:1.5},
  "gag-tornado": {label:"Habtornádó",duration:6,playbackSeconds:5,impact:1.1},
  "gag-bubble": {label:"Óriás buborék",duration:6,playbackSeconds:5,impact:1.1},
  "gag-rocket": {label:"Rakétaszék",duration:6,playbackSeconds:6,impact:1.5},
  "gag-meteor": {label:"Kozmikus pitezápor",duration:6,playbackSeconds:6,impact:1.3},
};
export const GAG_LINES: Record<GagKind,Record<"ali"|"isti",readonly string[]>> = {
 "gag-mud":{ali:["Pistának ma szar napja lesz!", "Pucu, ez a prémium arcpakolás!", "Pista, ebbe még a NAV se nyúl bele!"],isti:["Ali, te szarházi! Inasom vagy, nem kertészem!", "Nem baj, hagyjadddd! A kalapnak úgyis mindegy.", "Ali, ezt a borravalódból mosatod ki!"]},
 "gag-cream":{ali:["Pista, készül a habosított változatod!", "Pucu, végre édes lett a pofád!", "Pista, még egy cseresznye, és mehetsz a vitrinbe!"],isti:["Ali, inasom vagy, nem cukrászom!", "Nem baj, hagyjadddd! Legalább nem száraz a műsor.", "Ali, ezt még a tortából is levonom!"]},
 "gag-pie":{ali:["Pista, ma tányérral együtt kéred!", "Pucu, nyisd nagyra! Ja, a maszk marad.", "Pista, ez házhoz ment, pofára címezve!"],isti:["Ali, harminckét négyzetméter pizzát ettem, erre hozol még pitét?!", "Nem baj, hagyjadddd! A tányér kicsit ropogós.", "Ali, ezt még a számládhoz csapom!"]},
 "gag-slime":{ali:["Pista, indul a zöldprogram!", "Pucu, most már tényleg folyik belőled az ész!", "Pista, ezt az arcpakolást én kevertem!"],isti:["Ali, te ezt a mosógépből hoztad?!", "Nem baj, hagyjadddd! Most már zöld utam van.", "Ali, a vödröt legalább bérelted?!"]},
 "gag-spin":{ali:["Pista, most te kevered a műsort!", "Pucu, végre forog körülötted a világ!", "Pista, ez az ingyenes centrifuga!"],isti:["Ali, állítsd meg, a NAV-ot már kétszer láttam!", "Inasom vagy! Nem körhintás.", "Nem baj, hagyjadddd! Már a szék is szédül."]},
 "gag-confetti":{ali:["Pista, ünnepelünk! Téged csomagolunk be.", "Pucu, kapsz egy kis díszkivilágítást!", "Pista, ez a konfetti legalább színesíti a fejed!"],isti:["Ali, ezt te porszívózod fel! Inasom vagy!", "Nem baj, hagyjadddd! Én vagyok az ajándék.", "Ali, még a sértődésemet is becsomagoltad!"]},
 "gag-galaxy":{ali:["Pista megy a Holdra! Kapaszkodj a kalapodba!", "Pucu, feladlak csomagként a Tejútra!", "Pista, a NAV idáig már nem követ!"],isti:["Ali, az űrben is az inasom vagy!", "Nem baj, hagyjadddd! Legalább elkerülöm a NAV-ot.", "Ali, te dagadt! Visszafelé rád szállok!"]},
 "gag-tornado":{ali:["Pista, indul a habverő!", "Pucu, készül a családi kiszerelésű botrány!", "Pista, ez most tényleg felkavar!"],isti:["Ali, ez nem habverő, ez a rohadt mosógéped!", "Nem baj, hagyjadddd! Már fel se tudok háborodni.", "Ali, inasom vagy! Takarítsd fel!"]},
 "gag-bubble":{ali:["Pista, becsomagollak! Törékeny az egód.", "Pucu, most kipukkad a nagy arcod!", "Pista, buborékfóliába teszem a büszkeséged!"],isti:["Ali, tele a pénztárcám, nem férek bele!", "Nem baj, hagyjadddd! Legalább hangszigetelt.", "Ali, ezt az egómmal pukkasztom ki!"]},
 "gag-rocket":{ali:["Pista, felszállási engedély megadva!", "Pucu, rakétára kötöttem a trónodat!", "Pista, kapaszkodj, ez már nem a helyi járat!"],isti:["Ali, a visszaútra is te veszel jegyet!", "Nem baj, hagyjadddd! A NAV-nál kijelentkeztem.", "Ali, te dagadt! Megint súlyhatár fölött vagyunk!"]},
 "gag-meteor":{ali:["Pista, égből jön a desszert!", "Pucu, kérted a nagy adagot!", "Pista, ez nem időjárás, ez cukrászati katasztrófa!"],isti:["Ali, ez már több mint harminckét négyzetméter!", "Nem baj, hagyjadddd! Éhes úgyse maradok.", "Ali, kértem én az egész cukrászdát?!"]},
};
export const MUSIC_GIFT_LINE = "Ne dobd azt a szart, a kurva anyád!";
export const DEFAULT_MUSIC_GIFTS = "Zene, Music, Music Note, Musical Notes";
export const normalizeGift = (value: string) => value.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
export function isMusicGift(event: LiveEvent, names = DEFAULT_MUSIC_GIFTS, giftId = "") {
  if (event.type !== "gift") return false;
  if (giftId.trim()) return event.giftId === giftId.trim();
  return !!event.gift && names.split(",").map(normalizeGift).filter(Boolean).includes(normalizeGift(event.gift));
}
export function isGalaxyGift(event: LiveEvent, giftId = "") {
  if(event.type!=="gift")return false;
  if(giftId.trim())return event.giftId===giftId.trim();
  return ["galaxy","galaxis"].includes(normalizeGift(event.gift || ""));
}
/** Six random draws without replacement; avoid a repeat across bag boundaries, too. */
export class GiftGagPicker {
  private bag: GagKind[]=[];
  private last?:GagKind;
  constructor(private random:()=>number=Math.random){}
  pick(event:LiveEvent, galaxyId=""):GagKind|undefined {
    if(!isBigGift(event))return undefined;
    if(isGalaxyGift(event,galaxyId))return "gag-galaxy";
    if((event.giftValue||0)>=1000){
      const key=event.giftId||normalizeGift(event.gift||"");
      const hash=[...key].reduce((sum,c)=>(sum*31+c.charCodeAt(0))>>>0,0);
      return (event.giftValue||0)>=5000 ? (["gag-rocket","gag-meteor"] as const)[hash%2] : (["gag-tornado","gag-bubble"] as const)[hash%2];
    }
    if(!this.bag.length){
      this.bag=[...BASIC_GAGS];
      for(let i=this.bag.length-1;i>0;i--){const j=Math.min(i,Math.floor(this.random()*(i+1)));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
      if(this.bag[this.bag.length-1]===this.last)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag[this.bag.length-1],this.bag[0]];
    }
    return this.last=this.bag.pop()!;
  }
}
export type NpcManifest = { clips: {kind: NpcKind; status: string; url?: string;error?:string;attempts?:number}[]; voice: {status: string; url?: string}; ready: boolean };
