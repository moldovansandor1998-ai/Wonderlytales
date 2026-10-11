import type {HistoryTask} from '../providers/wavespeed';

/** Match a provider request to this owner's exact immutable image; a character name alone is insufficient. */
export function matchingElementRequests(tasks:HistoryTask[],name:string,image:string):HistoryTask[]{
 const owned=new URL(image);
 return tasks.filter(task=>{
  if(task.model!=='kwaivgi/kling-elements'||task.status==='deleted')return false;
  const input=task.inputs??task.input;
  if(input?.name!==name||typeof input.image!=='string')return false;
  try{const source=new URL(input.image);return source.protocol==='https:'&&source.origin===owned.origin&&source.pathname===owned.pathname;}catch{return false;}
 });
}
