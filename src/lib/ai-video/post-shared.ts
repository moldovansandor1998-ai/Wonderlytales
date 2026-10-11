import type {CastKey,SceneLine} from './episode-shared';
export type Language='hu'|'en';
export type MixSettings={background:number;voice:number;leftSpeaker:CastKey|null;layoutConfirmed:boolean;sourceSpeech:'none'|'mute'|'loop-intro'};
export const DEFAULT_MIX:MixSettings={background:.55,voice:1,leftSpeaker:null,layoutConfirmed:false,sourceSpeech:'none'};
export type LanguageVersion={dialogue?:SceneLine[];sourceHash?:string;translationApproved?:boolean;recordings:Record<string,string>;mix:MixSettings;jobId?:string;history:string[];approvedFingerprint?:string;approvedAt?:string};
export type PostScene={id:string;revision:number;variants:Partial<Record<Language,LanguageVersion>>};
export type PostJob={id:string;sceneId:string;language:Language;fingerprint:string;status:'PREPARING'|'PREPARED'|'SUBMITTING'|'PROCESSING'|'READY'|'FAILED'|'UNCERTAIN';sourceVideoId:string;duration:number;createdAt:string;videoAsset?:string;dialogueAsset?:string;speakerAssets?:string[];model?:'wavespeed-ai/infinitetalk/video-to-video'|'wavespeed-ai/infinitetalk/video-to-video-multi';prompt?:string;taskId?:string;price?:number;outputUrl?:string;lipAsset?:string;finalAsset?:string;error?:string};
export const POST_LABELS:Record<PostJob['status'],string>={PREPARING:'Hangsávok előkészítése',PREPARED:'Indításra kész',SUBMITTING:'Szájmozgáskérés beküldése',PROCESSING:'Szájmozgás készül',READY:'Hangos videó kész · ellenőrizd',FAILED:'Javítást igényel',UNCERTAIN:'Kérés ellenőrzést igényel · nincs automatikus újrafizetés'};
export const newVersion=():LanguageVersion=>({recordings:{},mix:{...DEFAULT_MIX},history:[]});
