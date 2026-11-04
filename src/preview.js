import {Trainer} from './engine.js';
import {TrainingScene} from './scene.js';
import {getAgent} from './data.js';
import {OFFICIAL_ASSETS} from './official-assets.js';
import {TrainingAudio} from './spatial-audio.js';
import {sub,normalize} from './math.js';

// Preview is a separate session. Scrubbing never writes scores or user profiles.
export class TechniquePreview {
  constructor(settings){
    this.settings=settings;this.dialog=document.getElementById('preview-dialog');this.playing=false;this.time=0;
    const el=id=>document.getElementById(id);this.el=el;
    el('preview-button').addEventListener('click',()=>this.open());
    const audioToggle=document.createElement('button');audioToggle.id='preview-audio';audioToggle.className='outline-button';audioToggle.textContent='模拟音效：关';el('preview-view').after(audioToggle);
    audioToggle.addEventListener('click',()=>{this.sound=!this.sound;audioToggle.textContent=this.sound?'模拟音效：开':'模拟音效：关';this.sound&&this.playing?this.audio.start():this.audio.pause();});
    el('preview-play').addEventListener('click',()=>{this.playing=!this.playing;if(this.time>=this.duration)this.seek(0);this.sound&&this.playing?this.audio.start():this.audio.pause();this.updateControls();});
    el('preview-replay').addEventListener('click',()=>{this.seek(0);this.playing=true;if(this.sound)this.audio.start();this.updateControls();});
    el('preview-timeline').addEventListener('input',event=>{this.playing=false;this.seek(Number(event.target.value));this.updateControls();});
    el('preview-view').addEventListener('change',()=>{this.scene.observerMode=el('preview-view').value;this.scene.render();});
    this.dialog.addEventListener('close',()=>{this.playing=false;this.audio.pause();el('reference-video').pause();el('reference-video').removeAttribute('src');el('reference-video').load();this.scene?.dispose();this.scene=null;});
  }
  reset(){
    if(this.game){this.game.reset();this.game.spawn();this.game.running=true;}
    this.time=0;this.shot=false;
  }
  open(){
    const agent=getAgent(this.settings.agent),variant=agent.variants.find(v=>v.id===this.settings.variant)||agent.variants[0];
    this.snapshot={...structuredClone(this.settings),random:false,mixVariants:false,rounds:1,mode:'stationary'};
    this.audio??=new TrainingAudio(this.snapshot);this.audio.settings=this.snapshot;if(this.sound)this.audio.start();
    this.game=new Trainer(this.snapshot,e=>{this.scene?.onEvent(e);if(this.sound&&!this.seeking)this.audio.event(e,this.game);},()=>.35);this.game.spawn();this.game.running=true;
    this.dialog.showModal();this.scene=new TrainingScene(this.el('preview-viewport'),this.game);this.scene.showTrajectory=true;this.scene.observerMode=this.el('preview-view').value;
    this.duration=Math.max(3,(Number.isFinite(this.game.threat.fuse)?this.game.threat.fuse:4)+this.game.threat.duration+.6);
    this.time=0;this.shot=false;this.playing=true;this.el('preview-timeline').max=this.duration;
    this.el('preview-title').textContent=`${agent.name} · ${variant.name}`;
    const assets=OFFICIAL_ASSETS[agent.id],key=variant.id==='clone'?'clone':'flash';
    const ability=assets?.abilities?.find(v=>v.key===key)||assets?.abilities?.[0];
    this.el('reference-video').hidden=!ability;this.el('reference-note').textContent=ability?'官方演示（离线）。旧版本画面仅供外观、动作参考。':'当前没有可核实的官方演示文件。';
    if(ability)this.el('reference-video').src='./'+ability.video;
    this.updateControls();let last=performance.now();
    const frame=now=>{
      if(!this.dialog.open)return;
      const dt=Math.min(.05,(now-last)/1000);last=now;
      if(this.playing){this.advance(dt*Number(this.el('preview-speed').value));if(this.time>=this.duration){this.playing=false;this.audio.pause();}else if(this.sound)this.audio.update(this.game);}
      this.scene.render();this.updateControls();requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  }
  advance(dt){
    let remaining=Math.min(dt,this.duration-this.time);
    while(remaining>1e-8){const slice=Math.min(remaining,1/120);this.game.update(slice);this.time+=slice;remaining-=slice;
      const t=this.game.threat;
      if(t?.mechanic==='clone'&&!this.shot&&t.age>=1.2){const target=normalize(sub(t.position,this.game.player));const yaw=this.game.yaw,pitch=this.game.pitch;this.game.yaw=Math.atan2(-target[0],-target[2]);this.game.pitch=Math.asin(target[1]);this.game.shoot();this.game.yaw=yaw;this.game.pitch=pitch;this.shot=true;}
    }
  }
  seek(time){this.audio.pause();this.seeking=true;try{this.reset();this.advance(time);this.scene.render();}finally{this.seeking=false;}}
  updateControls(){
    this.el('preview-play').textContent=this.playing?'暂停':'播放';this.el('preview-timeline').value=this.time;
    const t=this.game?.threat,stage=t?.resolved?'已结算':t?.stage==='activating'?'激活前摇':t?.bounced?'反弹后飞行':t?.stage==='dormant'?'预置等待':'释放 / 飞行';
    this.el('preview-clock').textContent=`${this.time.toFixed(2)} / ${this.duration?.toFixed(2)||'0.00'} s · ${stage}`;
    this.el('preview-geometry').textContent=t?`高度 ${t.position[1].toFixed(2)} m · 实际碰撞 ${t.events.length} 次${t.planNote?' · '+t.planNote:''}`:'';
  }
}
