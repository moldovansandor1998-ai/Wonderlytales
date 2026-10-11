export async function uploadImage(file:File):Promise<{sha256:string;width:number;height:number;mime:string}>{
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024)throw new Error('Legfeljebb 10 MB-os PNG vagy JPEG szükséges.');
 const bytes=await file.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const size=3*1024*1024;
 for(let i=0;i<Math.ceil(file.size/size);i++){const r=await fetch(`/api/ai-video/upload?action=chunk&sha256=${sha}&size=${file.size}&index=${i}`,{method:'POST',body:file.slice(i*size,(i+1)*size)});if(!r.ok)throw new Error('A képfeltöltés nem sikerült.');}
 const result=await fetch(`/api/ai-video/upload?action=complete&sha256=${sha}&size=${file.size}`,{method:'POST'});if(!result.ok)throw new Error('A képfeltöltés ellenőrzése nem sikerült.');return result.json();
}
export async function lastFrame(url:string):Promise<{file:File;time:number}>{
 const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
 try{return await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('A videó képkockájának betöltése túl sokáig tartott.')),45000);
  const fail=()=>{clearTimeout(timeout);reject(new Error('A videóból most nem vehető át képkocka.'));};
  video.onerror=fail;
  video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration)||video.duration<=0){fail();return;}video.currentTime=Math.max(0,video.duration-.001);};
  video.onseeked=()=>{try{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d')!.drawImage(video,0,0);canvas.toBlob(b=>{clearTimeout(timeout);if(!b){fail();return;}resolve({file:new File([b],'elozo-jelenet-utolso-kepkocka.png',{type:'image/png'}),time:video.currentTime});},'image/png');}catch{fail();}};
  video.src=url;
 });}finally{video.removeAttribute('src');video.load();}
}
