import type {CutShot,FilmCut} from './film-cut-shared';
import {cutCeiling} from './film-cut-shared';
import {EPISODE_SCENES} from './episode-data';
import type {CastKey} from './episode-shared';

export function hungarianRevision(c:FilmCut):CutShot[]{
 if(c.shots.length!==25||c.shots.at(-1)?.scene!==15||c.shots.some(s=>s.phase!=='READY'||!s.asset))throw new Error('CUT_REVIEW_REQUIRED');
 const lines:Record<string,{text:string;max:number}>={
  'shot-4-2':{text:'Félix, megállni! A betörés miatt kereslek. Tedd le a táskát.',max:7},
  'shot-10-12':{text:'Az irattárból eltűnt egy régi tárgy. Nálad van?',max:6},
  'shot-10-13':{text:'Beszéljünk róla odabent.',max:4},
 };
 let shots=c.shots.map((s):CutShot=>{
  const replacement=lines[s.id];
  if(replacement){
   const image=s.cropPreset||s.framingRepair?s.lastFrame:s.image;
   if(!image||!s.line)throw new Error('CUT_CAMERA_FRAME_MISSING');
   return {...s,id:s.id+'-hu-v2',line:{...s.line,text:replacement.text},maxSeconds:replacement.max,seconds:0,image,reframe:false,frameFrom:undefined,recording:undefined,audio:undefined,raw:undefined,cleaned:undefined,cleanupInput:undefined,cleanupSeconds:undefined,previousAsset:s.asset,asset:undefined,lastFrame:undefined,check:undefined,phase:'AUDIO',manualReviewRequired:true,priorVideoCost:undefined,cropPreset:undefined,framingRepair:undefined};
  }
  if([0,4,12].includes(s.scene)&&s.kind!=='speech'&&!s.audio)return {...s,id:s.id+'-hu-v2',previousAsset:s.asset,remixSource:s.asset,asset:undefined,removeNativeSpeech:true,phase:'AUDIO',audioReview:undefined};
  if(s.scene===13)return {...s,id:s.id+'-hu-v2',previousAsset:s.asset,remixSource:s.asset,asset:undefined,phase:'AUDIO'};
  return {...s};
 });
 const walking=shots.find(s=>s.scene===12&&s.kind==='action')!;
 walking.line={character:'mira',text:'Tilda segíthet. Menjünk be!',delivery:'offscreen',offset:.2};
 walking.maxSeconds=3;
 const entrance=shots.find(s=>s.scene===13)!;
 entrance.trimStart=2.5;entrance.seconds=2.5;entrance.label='Bent Tilda műhelyében';
 // The intention and reluctance come before the completed door entrance.
 shots=shots.filter(s=>s!==walking);shots.splice(shots.indexOf(entrance),0,walking);
 return shots;
}
export function revisionCeiling(shots:CutShot[]){
 return Math.ceil((cutCeiling(shots.filter(s=>s.phase!=='READY'&&!s.remixSource))+shots.filter(s=>s.removeNativeSpeech).length*.03+shots.filter(s=>s.remixSource&&s.line&&!s.recording).length*.25)*100)/100;
}

export function residualAudioRevision(c:FilmCut,bed:string):CutShot[]{
 if(c.revision!==3||c.shots.length!==25||c.shots.some(s=>s.phase!=='READY'||!s.asset))throw new Error('CUT_REVIEW_REQUIRED');
 return c.shots.map(s=>{
  if(s.scene===0||(s.scene===4&&s.kind==='action'))return {...s,id:s.id+'-hu-v4',previousAsset:s.asset,remixSource:s.asset,asset:undefined,audioBed:bed,removeNativeSpeech:false,audioReview:undefined,phase:'AUDIO'};
  if(s.id!=='shot-8-9')return {...s};
  const image=s.cropPreset||s.framingRepair?s.lastFrame:s.image;
  if(!image||!s.line)throw new Error('CUT_CAMERA_FRAME_MISSING');
  return {...s,id:s.id+'-hu-v4',line:{...s.line,text:'Nem tudom. Még nem nyitottam ki.'},maxSeconds:5,seconds:0,image,reframe:false,frameFrom:undefined,recording:undefined,audio:undefined,raw:undefined,cleaned:undefined,cleanupInput:undefined,cleanupSeconds:undefined,previousAsset:s.asset,asset:undefined,lastFrame:undefined,check:undefined,audioReview:undefined,phase:'AUDIO',manualReviewRequired:true,priorVideoCost:undefined,cropPreset:undefined,framingRepair:undefined};
 });
}

const caseRule='The same closed 25 cm cylindrical copper document case with green patina and one round city seal rests on the wooden counter beside the same backpack. No readable letters. The case and bag stay here throughout this sequence.';
const cameras:Record<string,string>={
 felix:'Felix the canonical red fox stands at the near side of the wooden counter, looking screen right toward Tilda and Mira off camera. His green jacket and cream shirt remain unchanged. Tight single-character medium close-up. No badge on Felix.',
 tilda:'Tilda the canonical pangolin mechanic stands behind the wooden counter at screen right, looking screen left toward Felix off camera. Exact scales, glasses and work apron. Tight single-character medium close-up.',
 mira:'Mira the canonical BROWN RABBIT detective stands beside the counter at screen left, looking screen right toward Felix. Exact long ears, green coat and police badge. Tight single-character medium close-up. No humans.',
 oszkar:'Oszkar the canonical male RED SQUIRREL bicycle courier stands inside the dark green workshop door. Exact helmet, red jacket and courier bag. He faces screen right toward Tilda and Mira off camera. Tight single-character medium close-up.',
};
export function continuationPlan():CutShot[]{
 const shots:CutShot[]=[];const firstCamera:Partial<Record<CastKey,string>>={};
 function action(scene:number,label:string,seconds:number,characters:CastKey[],frame:string,motion:string){
  shots.push({id:`next-${scene}-action`,scene,label,kind:'action',characters,seconds,maxSeconds:seconds,reframe:true,environment:scene===26?'street':'workshop',framePrompt:frame,motionPrompt:motion,phase:'WAITING',removeNativeSpeech:true});
 }
 for(let scene=16;scene<=30;scene++){
  const d=EPISODE_SCENES[scene];
  if(scene===17)action(scene,d.title,5,['felix'],'Medium insert on Felix and the workshop counter. The open backpack already lies on the counter. One copper cylinder protrudes from the bag. '+caseRule,'Felix visibly lifts the single copper case out of the open backpack and places it flat on the counter. His hands release it. Hold on the closed case for one second. No second case, no disappearing bag.');
  if(scene===25)action(scene,d.title,4,['mira'],'From inside the established workshop, Mira already stands beside the street window on the left. Through it the SAME silver car is parked across the SAME road. '+caseRule,'Mira draws the curtain edge aside slightly, looks at the parked silver car, then keeps watching. The car stays stationary. No new vehicles.');
  if(scene===26)action(scene,d.title,4,['oszkar'],'Exterior of the exact dark green workshop door and copper handle from the established street. Oszkar is fully visible beside his burgundy bicycle at screen left. He wears his canonical helmet, red jacket and courier bag.','Oszkar pushes his burgundy bicycle two steps to the workshop wall, leans it securely against the wall, releases the handlebar and steps toward the dark green door. Keep the bicycle visible outside.');
  if(scene===27)action(scene,'Oszkár belép a műhelybe',3,['oszkar'],'Interior wide shot facing the exact dark green entrance, copper bell above. Oszkar is already visible through the open doorway, outside the threshold. Bicycle stays outside. No other characters in frame.','Oszkar takes two visible steps across the threshold into the workshop, then stops beneath the bell. Keep helmet and courier bag on. A single bell movement follows the door opening. No teleportation.');
  if(scene===29)action(scene,'Oszkár átadja a szállítólevelet',3,['oszkar','mira'],'Medium insert of Oszkar on the left and Mira on the right beside the wooden counter. Oszkar holds ONE folded blank sheet. '+caseRule,'Oszkar extends the one folded paper to Mira; Mira takes it once and holds it near her closed notebook. Only the paper changes hands. The copper case and backpack stay on the counter. No generated text.');
  for(const [i,line] of d.dialogue.entries()){
   const maxSeconds=scene===21||scene===24?9:scene===27||scene===28||scene===22?6:scene===19&&i===1?5:scene===20&&i===1?3:scene===27&&i===1||scene===29&&i===1?3:5;
   const id=`next-${scene}-line-${i}`,from=firstCamera[line.character];
   shots.push({id,scene,label:`${d.title} · ${i+1}`,kind:'speech',characters:[line.character],line:{...line,offset:.2},lineIndex:i,seconds:0,maxSeconds,reframe:!from,frameFrom:from,environment:'workshop',framePrompt:cameras[line.character]+' '+(scene>=18?caseRule:'The bag is still with Felix. The case has not been revealed yet.'),motionPrompt:`The character speaks only the supplied Hungarian audio, with clear natural muzzle articulation, restrained gestures and a brief reaction after the last word. ${scene===23?'Felix stops joking, exhales, then admits his responsibility.':scene===30?'The realization is serious and changes the expression gradually.':''} All props stay still; do not pick up or move the case.`,phase:'WAITING'});
   // The first pre-reveal Felix plate must not be reused once the bag is on the counter.
   if(!from&&(scene!==16||line.character==='tilda'))firstCamera[line.character]=id;
  }
 }
 return shots;
}
