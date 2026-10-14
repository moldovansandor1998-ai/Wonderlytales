import { DJ_MOODS, type DjMood } from "./dj";
/** An original, continuously composed instrumental bed. No recording is looped. */
export class MusicBed {
  private context:AudioContext;
  private master:GainNode;
  private dry:GainNode;
  private noise:AudioBuffer;
  private timer?:ReturnType<typeof setInterval>;
  private at=0;
  private bar=0;
  private root=0;
  private running=false;
  private style:DjMood="groove";
  private tempo=96;
  private effects=false;
  mood(style:DjMood){
    if(style!==this.style&&this.running&&this.effects&&(style==="drama"||style==="party"))this.accent(style);
    this.style=style;
  }
  constructor(){
    this.context=new AudioContext();const ctx=this.context;
    this.master=ctx.createGain();this.master.gain.value=0;
    const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;
    this.master.connect(compressor);compressor.connect(ctx.destination);
    this.dry=ctx.createGain();this.dry.gain.value=0.65;this.dry.connect(this.master);
    this.noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const noise=this.noise.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
    const reverb=ctx.createConvolver(),impulse=ctx.createBuffer(2,ctx.sampleRate*2.4,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const samples=impulse.getChannelData(ch);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3.5);}
    reverb.buffer=impulse;const wet=ctx.createGain();wet.gain.value=0.2;this.dry.connect(reverb);reverb.connect(wet);wet.connect(this.master);
  }
  async unlock(){await this.context.resume();}
  volume(level:number,duck:boolean,instrumental=true,effects=true){
    const ctx=this.context;this.effects=effects;
    this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,level))*(duck?0.16:1),ctx.currentTime,duck?0.08:0.45);
    this.dry.gain.setTargetAtTime(instrumental?0.65:0,ctx.currentTime,0.25);
  }
  private accent(style:"drama"|"party"){
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime;
    osc.type="triangle";osc.frequency.setValueAtTime(style==="drama"?620:180,at);
    osc.frequency.exponentialRampToValueAtTime(style==="drama"?90:720,at+0.4);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(0.08,at+0.03);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.5);
    osc.connect(gain);gain.connect(this.master);osc.start(at);osc.stop(at+0.52);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  start(){if(this.running)return;this.running=true;this.at=this.context.currentTime+0.1;this.schedule();this.timer=setInterval(()=>this.schedule(),500);}
  private note(midi:number,at:number,duration:number,level:number,soft=false){
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type=soft?"triangle":"sine";osc.frequency.value=440*Math.pow(2,(midi-69)/12);
    filter.type="lowpass";filter.frequency.value=soft?680:2600;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+(soft?0.35:0.008));gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);
    osc.connect(filter);filter.connect(gain);gain.connect(this.dry);osc.start(at);osc.stop(at+duration+0.05);osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();};
  }
  private schedule(){
    if(!this.running||this.context.state!=="running")return;
    // Recover a throttled tab without scheduling a burst of missed notes.
    if(this.at<this.context.currentTime)this.at=this.context.currentTime+0.1;
    while(this.at<this.context.currentTime+0.5){
      // Change arrangement at a bar boundary, with a bounded tempo ramp.
      this.tempo+=Math.max(-8,Math.min(8,DJ_MOODS[this.style].bpm-this.tempo));
      const beat=60/this.tempo,barLength=beat*4;
      const choices=[0,3,5,7,8,10].filter(x=>x!==this.root);
      if(this.bar%2===0)this.root=choices[Math.floor(Math.random()*choices.length)];
      const chord=this.style==="banter"?[48+this.root,52+this.root,55+this.root,59+this.root]:[48+this.root,51+this.root,55+this.root,58+this.root];
      for(const tone of chord)this.note(tone,this.at,barLength*1.6,0.022,true);
      this.note(36+this.root,this.at,beat*2.5,0.085,true);
      if(Math.random()>.35)this.note(43+this.root,this.at+beat*2,beat*1.8,0.045,true);
      const pattern=Array.from({length:8},()=>Math.random());
      for(let i=0;i<8;i++)if(pattern[i]>(this.style==="drama"?.75:.38)){
        const note=chord[Math.floor(Math.random()*chord.length)]+(Math.random()>.8?24:12);
        this.note(note,this.at+i*beat/2,beat*(1+Math.random()),0.045+Math.random()*0.025);
        this.note(note+12,this.at+i*beat/2+0.006,beat*0.55,0.01);
      }
      if(this.style!=="chill")for(let i=0;i<4;i++){
        if(this.style==="party"||i%2===0)this.kick(this.at+i*beat);
        if(i%2===1)this.hat(this.at+i*beat,0.06,0.22);
        if(this.style!=="drama")this.hat(this.at+(i+0.5)*beat,0.025,0.05);
      }
      if(this.style==="drama")this.note(29+this.root,this.at,beat*2,0.07);
      this.bar++;this.at+=barLength;
    }
  }
  private kick(at:number){
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.frequency.setValueAtTime(130,at);osc.frequency.exponentialRampToValueAtTime(42,at+0.16);
    gain.gain.setValueAtTime(0.18,at);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.25);
    osc.connect(gain);gain.connect(this.dry);osc.start(at);osc.stop(at+0.26);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  private hat(at:number,level:number,duration:number){
    const ctx=this.context,source=ctx.createBufferSource();
    source.buffer=this.noise;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type="highpass";filter.frequency.value=6500;
    gain.gain.setValueAtTime(level,at);gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.dry);source.start(at);source.stop(at+duration+0.01);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  async stop(){this.running=false;clearInterval(this.timer);await this.context.close();}
}
