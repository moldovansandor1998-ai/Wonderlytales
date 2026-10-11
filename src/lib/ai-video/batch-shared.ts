import type {SceneState} from './episode-shared';
import type {AutoRun} from './automatic-shared';
import type {VideoElement} from './shared';
export type BatchItem={sceneId:string;title:string;original:SceneState;videoId:string;autoRunId:string;elements:VideoElement[];prepared?:boolean;finalAsset?:string};
export type BatchRun={id:string;items:BatchItem[];cursor:number;status:'QUEUED'|'RUNNING'|'READY'|'PAUSED';budget:'CLAIMED'|'RESERVED'|'UNCERTAIN';workflowId?:string;voices:AutoRun['voices'];voiceRows:AutoRun['voiceRows'];createdAt:string;updatedAt:string;maxCostUsd:number;error?:string};
export const BATCH_ERRORS:Record<string,string>={BATCH_CONSECUTIVE:'Legfeljebb 10, egymást közvetlenül követő történeti jelenetet jelölj ki.',BATCH_ACTIVE:'Már fut egy jelenetsor. Előbb várd meg a befejezését.',BATCH_SCENE_CHANGED:'Egy kijelölt jelenet közben megváltozott. A sor megállt, az elkészült videók megmaradtak.',BATCH_START_IMAGE:'Az első kijelölt jelenethez előbb vedd át és hagyd jóvá az előző videó utolsó képkockáját.',BATCH_FRAME_REQUIRED:'Az előző kész jelenet utolsó képkockája még nem vehető át.'};
