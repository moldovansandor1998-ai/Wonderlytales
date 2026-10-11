import { WaveSpeedError } from '../providers/wavespeed';

export function providerMediaUrl(value:unknown):string {
  if(typeof value!=='string')throw new WaveSpeedError('INVALID_MEDIA');
  const u=new URL(value);
  if(u.protocol!=='https:' || u.username || u.password || u.port || !['cloudfront.net','wavespeed.ai','wavespeed.net'].some(d=>u.hostname===d||u.hostname.endsWith(`.${d}`)))throw new WaveSpeedError('INVALID_MEDIA');
  return value;
}
export async function downloadProviderMedia(url:string,maxBytes:number) {
  providerMediaUrl(url);
  const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!r.ok || Number(r.headers.get('content-length')??0)>maxBytes || !r.body)throw new WaveSpeedError('INVALID_MEDIA');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new WaveSpeedError('INVALID_MEDIA');parts.push(value);}}
  finally{await reader.cancel();}
  if(!size)throw new WaveSpeedError('INVALID_MEDIA');
  return Buffer.concat(parts);
}
