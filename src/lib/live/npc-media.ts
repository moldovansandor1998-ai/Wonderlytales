import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Join three already-owned silent keyframe transitions, without another provider call. */
export async function joinNpcReaction(clips:Buffer[], executable=join(process.cwd(),"node_modules/ffmpeg-static/ffmpeg")) {
  if(clips.length!==3)throw new Error("NPC_REACTION_PARTS");
  const dir=await mkdtemp(join(tmpdir(),"wonderly-npc-"));
  try{
    for(let i=0;i<clips.length;i++)await writeFile(join(dir,`${i}.mp4`),clips[i]);
    await writeFile(join(dir,"concat.txt"),clips.map((_,i)=>`file '${i}.mp4'`).join("\n"));
    await promisify(execFile)(executable,["-nostdin","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",join(dir,"concat.txt"),"-map","0:v:0","-c:v","copy","-an","-movflags","+faststart",join(dir,"reaction.mp4")],{timeout:45000,maxBuffer:1000000});
    return await readFile(join(dir,"reaction.mp4"));
  }finally{await rm(dir,{recursive:true,force:true});}
}
