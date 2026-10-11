export type CreativeStatus = 'SUBMITTING'|'PROCESSING'|'COMPLETED'|'FAILED'|'UNCERTAIN'|'BLOCKED_BUDGET';
export type Reference = {characterId:string;name:string;sha256:string;updatedAt:string};
export type SceneImageInput = {id:string;prompt:string;characterIds:string[];referenceSha256?:string};
export type CreativeJob = {
  id:string;kind:'scene-image'|'analysis';requestHash:string;createdAt:string;status:CreativeStatus;
  model:string;estimatedCostUsd:number;taskId?:string;prompt:string;
  references?:Reference[];referenceSha256?:string;image?:{sha256:string;width:number;height:number;mime:string};
  text?:string;error?:string;
};
export const IMAGE_CEILING=.04;
export const ANALYSIS_CEILING=.02;
export const CREATIVE_LABELS:Record<CreativeStatus,string>={SUBMITTING:'Beküldés folyamatban',PROCESSING:'Feldolgozás folyamatban',COMPLETED:'Elkészült',FAILED:'Nem fejeződött be · nincs új fizetős próba',UNCERTAIN:'Bizonytalan beküldés · nincs új fizetős próba',BLOCKED_BUDGET:'A költségkeret megállította'};
