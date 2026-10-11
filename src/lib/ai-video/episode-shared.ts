import type {VideoJob} from './shared';
import type {CreativeJob} from './creative-shared';
import type {DialogueRecording} from './dialogue';

export const CAST = {
  felix:{id:'fc68c57c-443f-46d6-a509-4473ce7b0aa9',name:'Félix',description:'Vörös róka · betörő',voiceName:'Morzsi'},
  mira:{id:'2f0eb3f6-0953-598e-8dad-e6cc0a6963a0',name:'Mira',description:'Barna nyúl · rendőrnyomozó',voiceName:'Lili'},
  nera:{id:'cbdb8391-dea7-5ac0-8841-c83cc5d3f5e9',name:'Néra',description:'Nyest · műkereskedő',voiceName:'Pötty'},
  tilda:{id:'cc299a50-e504-53e9-aac9-c9dbb51c298a',name:'Tilda',description:'Tobzoska · szerelő',voiceName:'Zizi'},
  oszkar:{id:'630ed3ce-dd2c-5111-ae74-9194443a8156',name:'Oszkár',description:'Mókus · kerékpáros futár',voiceName:'Márk'},
} as const;
export type CastKey=keyof typeof CAST;
export type SceneLine={character:CastKey;text:string;offset:number;delivery:'visible'|'offscreen'};
export type SceneDefinition={id:string;order:number;title:string;act:string;location:string;duration:10;characters:CastKey[];imagePrompt:string;prompt:string;dialogue:SceneLine[];continuity:string;kind:'intro'|'story'|'outro'};
export type SceneState={id:string;revision:number;updatedAt:string;mode:'image'|'last-frame';imagePrompt:string;prompt:string;characters:CastKey[];dialogue:SceneLine[];imageSha256?:string;imageApproved:boolean;imageJobId?:string;imageRequest?:{id:string;prompt:string;characterIds:string[];referenceSha256?:string};videoJobId?:string;videoRequest?:{id:string;imageSha256:string;prompt:string;duration:10;sound:boolean;maxCostUsd:number};videoHistory:string[];imageHistory:string[];recordings:Record<string,string>;review:'pending'|'keep'|'trim'|'needs-work';note:string;trimStart:number;trimEnd:number;sound:boolean;sourceJobId?:string;sourceTime?:number};
export type EpisodeScene={definition:SceneDefinition;state:SceneState;video:VideoJob|null;imageJob:CreativeJob|null;recordings:Record<string,DialogueRecording>;analysis:CreativeJob|null};
export type EpisodeCast=Record<CastKey,{id:string;name:string;sha256:string|null;voiceId:string|null}>;
export type EpisodeOverview={title:string;duration:number;scenes:EpisodeScene[];cast:EpisodeCast};
export const timecode=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
