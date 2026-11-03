import {OFFICIAL_SOUNDS} from './official-sounds.js';
import {forward,distance,occluded} from './math.js';
export class TrainingAudio {
  constructor(settings){this.settings=settings;this.buffers=new Map();this.active=new Set();this.nextWing=0;this.loadErrors=[];}
  async start(){
    this.ctx??=new AudioContext({latencyHint:'interactive'});if(this.ctx.state==='suspended')await this.ctx.resume();
    this.loading??=Promise.allSettled([...new Set(Object.values(OFFICIAL_SOUNDS).flatMap(Object.values))].map(async path=>{
      try{const r=await fetch(new URL('../'+path,import.meta.url));if(!r.ok)throw Error(String(r.status));const buffer=await this.ctx.decodeAudioData(await r.arrayBuffer());this.buffers.set(path,buffer);}catch(e){this.loadErrors.push(path+': '+e.message);}
    }));
  }
  pause(){for(const source of this.active){try{source.stop();}catch{}}this.active.clear();this.ctx?.suspend();}
  output(source,position,game,gain=.2){
    if(!this.ctx||this.ctx.state!=='running'||!this.settings.volume)return;
    const amp=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),panner=this.ctx.createPanner();
    const covered=position&&occluded(game.player,position,game.map.boxes),range=position?distance(game.player,position):0;
    amp.gain.value=this.settings.volume*gain*(covered?.5:1)/(1+range*.045);filter.type='lowpass';filter.frequency.value=covered?1800:14000;
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=8;panner.rolloffFactor=.3;panner.maxDistance=80;
    const point=position||game.player;panner.positionX.value=point[0];panner.positionY.value=point[1];panner.positionZ.value=point[2];
    source.connect(filter).connect(amp).connect(panner).connect(this.ctx.destination);this.active.add(source);
    source.onended=()=>{this.active.delete(source);source.disconnect();filter.disconnect();amp.disconnect();panner.disconnect();};source.start();
    return amp;
  }
  clip(path,position,game,gain=.65){const buffer=this.buffers.get(path);if(!buffer)return false;const source=this.ctx.createBufferSource();source.buffer=buffer;this.output(source,position,game,gain);return true;}
  tone(frequency,duration,position,game,gain=.12,end=frequency*.5,type='sine'){
    if(!this.ctx||this.ctx.state!=='running')return;const now=this.ctx.currentTime,o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(Math.max(30,end),now+duration);
    const amp=this.output(o,position,game,gain);if(!amp)return;amp.gain.exponentialRampToValueAtTime(.0001,now+duration);o.stop(now+duration);
  }
  noise(duration,position,game,gain=.15){
    if(!this.ctx||this.ctx.state!=='running')return;const samples=Math.ceil(this.ctx.sampleRate*duration),b=this.ctx.createBuffer(1,samples,this.ctx.sampleRate),channel=b.getChannelData(0);
    for(let i=0;i<samples;i++)channel[i]=(Math.random()*2-1)*(1-i/samples)**2;
    const s=this.ctx.createBufferSource();s.buffer=b;this.output(s,position,game,gain);
  }
  update(game){
    if(!this.ctx||this.ctx.state!=='running')return;const l=this.ctx.listener,p=game.player,f=forward(game.yaw,game.pitch);
    for(const [key,value] of Object.entries({positionX:p[0],positionY:p[1],positionZ:p[2],forwardX:f[0],forwardY:f[1],forwardZ:f[2],upX:0,upY:1,upZ:0}))if(l[key])l[key].value=value;
    const t=game.threat;if(game.running&&t&&!t.resolved&&t.agent.id==='skye'&&t.stage==='flying'&&game.time>=this.nextWing){this.nextWing=game.time+.22;this.noise(.1,t.position,game,.08);}
  }
  event(e,game){
    if(!this.ctx||!this.settings.volume)return;const t=e.threat,p=t?.position,id=t?.agent.id;
    if(e.type==='result'&&e.result.effect!=='flash')return;
    if(e.type==='spawn')this.nextWing=game.time+.1;
    const path=OFFICIAL_SOUNDS[id]?.[e.type];if(path&&this.clip(path,p,game))return;
    if(e.type==='spawn'){
      // KAY/O has no continuous flight telegraph audio (3.06).
      if(id==='kayo')return;
      if(id==='skye'){this.noise(.18,p,game,.16);this.tone(1750,.2,p,game,.1,2500);}
      else if(id==='breach'){this.noise(.2,p,game,.35);this.tone(180,.3,p,game,.2,600,'sawtooth');}
      else if(id==='phoenix'){this.noise(.25,p,game,.22);this.tone(650,.18,p,game,.1,1250);}
      else this.tone(500,.2,p,game,.08,750);
    }
    if(e.type==='bounce'){this.noise(.055,p,game,.14);this.tone(950,.065,p,game,.08,400,'triangle');}
    if(e.type==='bounce-arm')this.tone(900,.22,p,game,.15,1800,'triangle');
    if(e.type==='telegraph')this.tone(1350,.25,p,game,.14,2400);
    if(e.type==='charged')this.tone(1500,.12,p,game,.08,2200);
    if(['activate','lock','redirect','clone'].includes(e.type)){this.tone(id==='skye'?2200:1050,.2,p,game,.17,id==='skye'?3200:1800);this.noise(.1,p,game,.1);}
    if(e.type==='result'&&t?.agent.kind==='flash'&&!['ignored','destroyed'].includes(e.result.outcome)){this.noise(.23,p,game,.45);this.tone(350,.23,p,game,.15,70);}
    if(e.type==='shot'){this.noise(.055,null,game,.25);this.tone(120,.05,null,game,.14,40,'sawtooth');}
    if(e.type==='hit')this.tone(1700,.05,p,game,.08,900);
  }
}
