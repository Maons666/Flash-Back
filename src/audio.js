export class TrainingAudio {
  constructor(settings){this.settings=settings;}
  async start(){this.ctx??=new AudioContext({latencyHint:'interactive'});if(this.ctx.state==='suspended')await this.ctx.resume();}
  pause(){this.ctx?.suspend();}
  tone(frequency,duration=.12,type='sine',pan=0,gain=.15) {
    if(!this.ctx||this.ctx.state!=='running'||!this.settings.volume)return;
    const now=this.ctx.currentTime,osc=this.ctx.createOscillator(),amp=this.ctx.createGain(),panner=this.ctx.createStereoPanner();
    osc.type=type;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(frequency*.65,now+duration);
    amp.gain.setValueAtTime(gain*this.settings.volume,now);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
    panner.pan.value=Math.max(-1,Math.min(1,pan));osc.connect(amp).connect(panner).connect(this.ctx.destination);osc.start(now);osc.stop(now+duration);
  }
  event(e,game){
    const pan=e.threat?Math.sin(Math.atan2(e.threat.position[0]-game.player[0],game.player[2]-e.threat.position[2])+game.yaw):0;
    if(e.type==='spawn'&&e.threat.stage!=='unarmed')this.tone({hush:740,phoenix:440,breach:240,skye:1200,kayo:550,yoru:850,vyse:1400,gekko:1000}[e.threat.agent.id]||320,.16,'sine',pan,.1);
    if(e.type==='bounce')this.tone(780,.1,'triangle',pan,.2);
    if(['lock','redirect','clone','activate'].includes(e.type))this.tone(1100,.15,'triangle',pan,.12);
    if(e.type==='result'&&!['ignored','destroyed'].includes(e.result.outcome))this.tone(120,.2,'triangle',pan,.16);
    if(e.type==='shot')this.tone(105,.065,'sawtooth',0,.13);
    if(e.type==='hit')this.tone(1700,.06,'sine',0,.1);
  }
}
