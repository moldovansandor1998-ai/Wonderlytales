/** An original, continuously composed instrumental bed. No recording is looped. */
export class MusicBed {
  private context:AudioContext;
  private master:GainNode;
  private dry:GainNode;
  private timer?:ReturnType<typeof setInterval>;
  private at=0;
  private bar=0;
  private root=0;
  private running=false;
  constructor(){
    this.context=new AudioContext();const ctx=this.context;
    this.master=ctx.createGain();this.master.gain.value=0;
    const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;
    this.master.connect(compressor);compressor.connect(ctx.destination);
    this.dry=ctx.createGain();this.dry.gain.value=0.65;this.dry.connect(this.master);
    const reverb=ctx.createConvolver(),impulse=ctx.createBuffer(2,ctx.sampleRate*2.4,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const samples=impulse.getChannelData(ch);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3.5);}
    reverb.buffer=impulse;const wet=ctx.createGain();wet.gain.value=0.2;this.dry.connect(reverb);reverb.connect(wet);wet.connect(this.master);
  }
  async unlock(){await this.context.resume();}
  volume(level:number,duck:boolean){const ctx=this.context;this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,level))*(duck?0.16:1),ctx.currentTime,duck?0.08:0.45);}
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
    const beat=60/82,barLength=beat*4;
    while(this.at<this.context.currentTime+5){
      const choices=[0,3,5,7,8,10].filter(x=>x!==this.root);
      if(this.bar%2===0)this.root=choices[Math.floor(Math.random()*choices.length)];
      const chord=[48+this.root,51+this.root,55+this.root,58+this.root];
      for(const tone of chord)this.note(tone,this.at,barLength*1.6,0.022,true);
      this.note(36+this.root,this.at,beat*2.5,0.085,true);
      if(Math.random()>.35)this.note(43+this.root,this.at+beat*2,beat*1.8,0.045,true);
      const pattern=Array.from({length:8},()=>Math.random());
      for(let i=0;i<8;i++)if(pattern[i]>.38){
        const note=chord[Math.floor(Math.random()*chord.length)]+(Math.random()>.8?24:12);
        this.note(note,this.at+i*beat/2,beat*(1+Math.random()),0.045+Math.random()*0.025);
        this.note(note+12,this.at+i*beat/2+0.006,beat*0.55,0.01);
      }
      this.bar++;this.at+=barLength;
    }
  }
  async stop(){this.running=false;clearInterval(this.timer);await this.context.close();}
}
