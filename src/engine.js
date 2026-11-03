import { getAgent, FLASH_AGENTS, PATCH, SIMULATION_REVISION } from './data.js';
import { resolveTiming } from './accuracy.js';
import { add, sub, scale, dot, normalize, distance, lerp, forward, angleTo, clamp, trace, occluded, movePlayer, flashExposure, bounceFuse, yawDelta, inView } from './math.js';
import { makeMap } from './maps.js';
import { planThreat, sampleRoute } from './trajectories.js';

export class Trainer {
  constructor(settings, onEvent=()=>{}, random=Math.random) {
    this.settings=settings;this.emit=onEvent;this.random=random;this.keys=new Set();this.reset();
  }
  reset() {
    this.map=makeMap(this.settings.arena,this.settings.custom);this.player=[...this.map.spawn];
    this.yaw=0;this.pitch=0;this.time=0;this.running=false;this.phase='ready';this.round=0;this.results=[];
    this.threat=null;this.effect=null;this.gateIndex=0;this.gate=null;this.lastShot=-1;this.lastResult=null;this.keys.clear();
  }
  start() {this.running=true;if(this.phase==='ready'||this.phase==='complete'){if(this.phase==='complete')this.reset();this.running=true;this.queueRound();}}
  pause() {this.running=false;this.keys.clear();}
  queueRound() {
    if(this.results.length>=this.settings.rounds){this.phase='complete';this.running=false;this.emit({type:'complete',results:this.results});return;}
    this.threat=null;this.effect=null;this.phase='waiting';
    this.nextAt=this.time+Number(this.settings.interval)+this.random()*1.3;
    if(this.settings.mode==='corner') {
      const gates=[[0,0,6],[0,0,1],[0,0,-4],[0,0,-9]];
      this.gate=gates[this.gateIndex%gates.length];
      if(this.gateIndex>0&&this.gateIndex%gates.length===0){this.player=[...this.map.spawn];this.yaw=0;this.pitch=0;}
      this.gateIndex++;
    } else this.gate=null;
  }
  look(dx,dy) {
    if(!this.running)return;
    this.yaw-=yawDelta(dx,this.settings.sensitivity,this.settings.calibration);
    this.pitch=clamp(this.pitch-yawDelta(dy,this.settings.sensitivity,this.settings.calibration),-1.5,1.5);
    this.trackReaction();
  }
  trackReaction() {
    const t=this.threat;if(!t||t.seenAt===null||t.reaction!==null)return;
    if(angleTo(forward(this.yaw,this.pitch),[0,0,0],t.initialLook)>8||distance(this.player,t.initialPlayer)>.2)t.reaction=Math.max(0,(this.time-t.seenAt)*1000);
  }
  markPresented() {
    const t=this.threat;
    if(!t||t.dead||t.resolved||!t.visible||t.seenAt!==null)return;
    if(!occluded(this.player,t.position,this.map.boxes)&&inView(this.player,t.position,this.yaw,this.pitch)) {
      t.seenAt=this.time;t.initialLook=forward(this.yaw,this.pitch);t.initialPlayer=[...this.player];
    }
  }
  spawn(agentOverride,variantOverride) {
    const agent=agentOverride|| (this.settings.random?FLASH_AGENTS[Math.floor(this.random()*FLASH_AGENTS.length)]:getAgent(this.settings.agent));
    const variant=variantOverride||((this.settings.random||this.settings.mixVariants)?agent.variants[Math.floor(this.random()*agent.variants.length)]:agent.variants.find(v=>v.id===this.settings.variant)||agent.variants[0]);
    const dir=forward(this.yaw,0), right=[-dir[2],0,dir[0]];
    const side=this.settings.side==='left'?-1:this.settings.side==='right'?1:(this.random()<.5?-1:1);
    const anchor=add(this.player,add(scale(dir,6.5),scale(right,side*1.8)));
    anchor[1]=1.8;
    // Find a real wall face for wall-mounted abilities, and a reachable sightline
    // for airborne abilities even when a roaming player has changed position.
    let source=anchor;
    if(['breach','vyse'].includes(agent.id)) {
      const hit=trace(this.player,add(this.player,scale(normalize(sub(anchor,this.player)),35)),this.map.boxes);
      if(hit)source=add(hit.point,scale(hit.normal,.08));
    } else if(agent.id!=='omen'&&!(agent.id==='harbor'&&variant.id==='wave')) {
      const hit=trace(this.player,anchor,this.map.boxes);
      if(hit)source=lerp(this.player,hit.point,.78);
    }
    const timing=resolveTiming(agent,variant,this.settings),fuse=timing.windup;
    const t=this.threat={agent,variant,position:[...source],origin:[...source],age:0,fuse,
      timing,duration:timing.duration,
      initialLook:forward(this.yaw,this.pitch),initialPlayer:[...this.player],
      seenAt:null,reaction:null,angle:0,side,right,dir,events:[],stage:'flying',health:1,
      bounced:false,dead:false,resolved:false,visible:true,trail:[],travel:0};
    this.round++;this.phase='threat';this.gate=null;this.lastResult=null;
    // Launch geometry and ballistic parameters are centralized in planThreat.
    if(agent.id==='yoru'&&variant.id==='clone'){t.position[1]=.9;t.stage='clone';t.fuse=Infinity;t.timeout=4;t.health=1;}
    if(agent.id==='gekko'){t.position[1]=2.8;t.stage='deploy';t.fuse=Infinity;t.health=1;t.activeAt=timing.windup;t.expires=t.activeAt+1;}
    if(agent.id==='reyna'){t.stage='eye';t.health=2;t.fuse=Infinity;t.expires=timing.duration;t.exposed=0;}
    if(agent.id==='omen'||(agent.id==='harbor'&&variant.id==='wave')){t.velocity=scale(normalize(sub(this.player,t.position)),agent.id==='omen'?20:10);t.fuse=Infinity;t.stage='wave';t.maxTravel=agent.id==='omen'?25:35;}
    if(agent.id==='fade'){t.position[1]=.65;t.health=3;t.fuse=Infinity;t.stage='chase';t.expires=4;}
    if(agent.id==='harbor'&&(variant.mechanic||variant.id)==='surge'){t.position=add(this.player,scale(dir,1.2));t.position[1]=.05;}
    planThreat(t,this);
    this.emit({type:'spawn',threat:t});
  }
  update(dt) {
    if(!this.running||!Number.isFinite(dt)||dt<=0)return;
    // Subdivide movement, but land exactly on scheduled state transitions.
    // This is a numerical bound, not a claim about Riot's server implementation.
    let remaining=dt;
    while(remaining>1e-10&&this.running) {
      let slice=Math.min(remaining,1/240);const t=this.threat;
      const deadlines=[];
      if(this.phase==='waiting')deadlines.push(this.nextAt-this.time);
      if(this.phase==='recovery')deadlines.push(this.recoverUntil-this.time);
      if(t&&!t.resolved) {
        deadlines.push(t.fuse-t.age,t.timeout-t.age,t.expires-t.age,t.activeAt-t.age,t.fireAt-t.age,t.impactAt-t.age,t.activateAt-t.age,t.timing.windup-t.age);
        if(t.agent.id==='hush'&&!t.redirected)deadlines.push(t.redirectAt-t.age);
        if(t.agent.id==='skye')deadlines.push(.75-t.age);
        if(t.agent.id==='kayo')deadlines.push(t.fuse-.3-t.age);
        if(t.armAt)deadlines.push(t.armAt-t.age);
      }
      for(const deadline of deadlines)if(deadline>1e-9&&deadline<slice)slice=deadline;
      this.updateStep(slice);remaining-=slice;
    }
  }
  updateStep(dt) {
    this.time+=dt;
    if(this.settings.mode!=='stationary') {
      const f=forward(this.yaw),r=[-f[2],0,f[0]];
      const walk=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'), crouch=this.keys.has('ControlLeft');
      let speed=crouch?2.1:walk?3.5:5.4;
      if(this.effect?.slow&&this.effect.until>this.time)speed*=.7;
      let move=add(scale(f,Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'))),scale(r,Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'))));
      move=scale(normalize(move),speed*dt);this.player=movePlayer(this.player,move,this.map.boxes);
      this.player[1]=crouch?1.05:1.65;this.trackReaction();
    }
    const priorThreat=this.threat;
    if(this.phase==='waiting'&&this.time+1e-9>=this.nextAt) {
      if(!this.gate||Math.hypot(this.player[0]-this.gate[0],this.player[2]-this.gate[2])<1.5)this.spawn();
    }
    const t=this.threat;
    if(t===priorThreat&&t&&!t.dead&&!t.resolved)this.updateThreat(t,dt);
    if(this.lastResult&&this.lastResult.returnMs===null&&this.lastResult.turnAngle>=70&&this.time>=this.lastResult.at) {
      if(angleTo(forward(this.yaw,this.pitch),[0,0,0],this.lastResult.initialLook)<10){this.lastResult.returnMs=Math.round((this.time-this.lastResult.at)*1000);this.emit({type:'return',result:this.lastResult});}
    }
    if(this.phase==='recovery'&&this.time+1e-9>=this.recoverUntil)this.queueRound();
    if(this.effect&&this.time+1e-9>=this.effect.until)this.effect=null;
  }
  updateThreat(t,dt) {
    t.age+=dt;
    const {agent,variant}=t;const before=[...t.position];
    if(agent.id==='phoenix') {
      const u=clamp(t.age/t.fuse,0,1);const next=add(add(scale(t.start,(1-u)**2),scale(t.control,2*u*(1-u))),scale(t.origin,u*u));
      if(!t.stopped){const hit=trace(before,next,this.map.boxes,.08);t.position=hit?add(hit.point,scale(hit.normal,.1)):next;t.stopped=Boolean(hit);}
    }
    if(agent.id==='skye') {
      const sample=sampleRoute(t.route,Math.min(t.age,t.activateAt)*t.motion.speed),next=sample.position;
      if(!t.stopped){const hit=trace(before,next,this.map.boxes,.1);t.position=hit?add(hit.point,scale(hit.normal,.015)):next;t.stopped=Boolean(hit);t.direction=sample.direction;if(hit)t.events.push({type:'contact',at:t.age,position:[...t.position],normal:hit.normal});}
      if(t.age+1e-9>=.75&&!t.charged){t.charged=true;this.emit({type:'charged',threat:t});}
      if(t.age+1e-9>=t.activateAt&&t.stage==='flying'){t.stage='activating';t.stopped=true;this.emit({type:'activate',threat:t});}
    }
    if(agent.id==='hush') {
      this.projectile(t,dt,t.redirected?0:t.motion.gravity,'impact');
      if(!t.resolved&&t.mechanic==='redirect'&&t.age+1e-9>=t.redirectAt&&!t.redirected){t.velocity=scale(normalize(sub(add(t.launchTarget,scale(t.dir,4)),t.position)),t.motion.speed);t.redirected=true;this.emit({type:'redirect',threat:t});}
    }
    if(agent.id==='kayo'){
      this.projectile(t,dt,t.motion.gravity,'kayo');
      if(!t.telegraph&&t.age+1e-9>=t.fuse-.3){t.telegraph=true;this.emit({type:'telegraph',threat:t});}
    }
    if(agent.id==='vyse'&&t.stage==='dormant'&&t.age+1e-9>=t.armAt){t.stage='activating';this.emit({type:'activate',threat:t});}
    if(agent.id==='yoru') {
      if(t.mechanic==='bounce'){
        this.projectile(t,dt,t.bounced?0:t.motion.gravity,'yoru');
        if(!t.bounced&&t.age>=t.timeout){this.finish(t,{outcome:'evaded',success:true,label:'未激活闪球',duration:0,angle:0});return;}
      }
      else if(t.stage==='clone') {
        const next=add(t.position,scale(t.dir,-2*dt));const hit=trace(t.position,next,this.map.boxes,.2);if(!hit)t.position=next;
        if(t.age>=t.timeout){this.finish(t,{outcome:'ignored',success:true,label:'识破分身',duration:0,angle:0});return;}
      }
    }
    if(agent.id==='gekko') {
      if(t.stage==='deploy'&&t.age<=t.activeAt+1e-9)this.projectile(t,dt,t.motion.gravity,'dizzy');
      const target=this.dizzyTarget(t);
      if(t.stage!=='plasma'&&t.age+1e-9>=t.expires){this.finish(t,{outcome:'cover',success:true,label:'阻断锁定',duration:0,angle:0});return;}
      if(t.stage==='deploy'&&t.age+1e-9>=t.activeAt&&target){t.stage='lock';t.fireAt=t.age+.35;this.emit({type:'lock',threat:t});}
      if(t.stage==='lock'&&!target){t.stage='deploy';t.fireAt=undefined;}
      if(t.stage==='lock'&&t.age+1e-9>=t.fireAt){
        t.stage='plasma';t.target=target;t.bolt=[...t.position];t.boltStart=[...t.position];t.firedAt=t.age;t.impactAt=t.age+distance(t.position,t.target)/100;
      }
      if(t.stage==='plasma'){
        t.bolt=lerp(t.boltStart,t.target,clamp((t.age-t.firedAt)/(t.impactAt-t.firedAt||1),0,1));
        if(t.age+1e-9>=t.impactAt){const hit=distance(this.player,t.target)<2.5&&!occluded(t.boltStart,t.target,this.map.boxes)&&!occluded(t.target,this.player,this.map.boxes);this.finish(t,{outcome:hit?'hit':'evaded',success:!hit,label:hit?'电浆命中':'避开电浆',duration:hit?t.duration:0,angle:angleTo(forward(this.yaw,this.pitch),this.player,t.position),effect:'plasma'});return;}
      }
    }
    if(agent.id==='reyna') {
      t.position=lerp(t.eyeStart,t.eyeTarget,clamp(t.age/t.timing.windup,0,1));
      const activeDt=Math.max(0,Math.min(t.age,t.expires)-Math.max(t.age-dt,t.timing.windup));
      const visible=!occluded(this.player,t.position,this.map.boxes)&&inView(this.player,t.position,this.yaw,this.pitch);
      if(visible)t.exposed+=activeDt;
      const inSight=t.age+1e-9>=t.timing.windup&&t.age<t.expires-1e-9&&visible;
      if(inSight){this.effect={type:'near',source:'reyna',until:Infinity,duration:0,strength:1};}
      else if(this.effect?.source==='reyna')this.effect=null;
      if(t.age+1e-9>=t.expires){this.finish(t,{outcome:t.exposed<.25?'evaded':'hit',success:t.exposed<.25,label:t.exposed<.25?'避开魔眼':'持续近视',duration:t.exposed,angle:0,noAfterEffect:true});return;}
    }
    if(t.stage==='wave') {
      if(t.age>t.timing.windup+1e-9){
        t.position=add(t.position,scale(t.velocity,dt));t.travel+=Math.hypot(...t.velocity)*dt;
        const closest=lerp(before,t.position,clamp(dot(sub(this.player,before),sub(t.position,before))/(distance(before,t.position)**2||1),0,1));
        if(distance(closest,this.player)<(agent.id==='harbor'?2.6:1.5)){this.finish(t,{outcome:'hit',success:false,label:'被近视命中',duration:t.duration,angle:0,effect:'near',slow:agent.id==='harbor'});return;}
        if(t.travel>t.maxTravel){this.finish(t,{outcome:'evaded',success:true,label:'躲开弹道',duration:0,angle:0});return;}
      }
    }
    if(agent.id==='fade') {
      if(t.age>t.timing.windup+1e-9){const next=add(t.position,scale(normalize(sub([this.player[0],.65,this.player[2]],t.position)),7*dt));t.position=movePlayer(t.position,sub(next,t.position),this.map.boxes,.3);}
      if(distance(t.position,[this.player[0],.65,this.player[2]])<.7){this.finish(t,{outcome:'hit',success:false,label:'黯兽扑咬',duration:t.duration,angle:0,effect:'near'});return;}
      if(t.age>=t.expires){this.finish(t,{outcome:'evaded',success:true,label:'避开黯兽',duration:0,angle:0});return;}
    }
    if(!this.presentationTiming)this.markPresented();
    if(t.age+1e-9>=t.fuse&&!t.resolved)this.detonate(t);
    if(!t.trail.length||distance(t.trail.at(-1).position,t.position)>.06)t.trail.push({position:[...t.position],at:t.age});
    t.trail=t.trail.filter(p=>t.age-p.at<.28).slice(-80);
    if(distance(t.history.at(-1),t.position)>.1&&t.history.length<1024)t.history.push([...t.position]);
  }
  dizzyTarget(t) {
    if(distance(t.position,this.player)>45)return null;
    // 12.08: head visibility is not required. Our body sample locations remain
    // an approximation of the game capsule, but respect real arena occlusion.
    for(const offset of [0,-.55,-1.1]) {
      const target=add(this.player,[0,offset,0]);target[1]=Math.max(.25,target[1]);
      if(!occluded(t.position,target,this.map.boxes))return target;
    }
    return null;
  }
  projectile(t,dt,gravity,kind,depth=0,startAge=t.age-dt,startTime=this.time-dt) {
    if(depth>5||dt<1e-10)return;
    const velocity=[...t.velocity];
    const untilFuse=t.fuse-startAge;
    if(untilFuse>=0&&untilFuse<dt-1e-9){this.projectile(t,untilFuse,gravity,kind,depth+1,startAge,startTime);if(!t.resolved)this.detonate(t,startTime+untilFuse);return;}
    const next=add(add(t.position,scale(velocity,dt)),[0,-.5*gravity*dt*dt,0]);
    let hit=trace(t.position,next,this.map.boxes,.08);
    if(next[1]<.12&&next[1]<t.position[1]){const f=(.12-t.position[1])/(next[1]-t.position[1]);const floor={t:clamp(f,0,1),normal:[0,1,0],point:lerp(t.position,next,clamp(f,0,1))};if(!hit||floor.t<hit.t)hit=floor;}
    if(!hit){t.position=next;t.velocity[1]=velocity[1]-gravity*dt;return;}
    const used=dt*hit.t,hitAge=startAge+used;
    t.velocity[1]=velocity[1]-gravity*used;
    t.position=add(hit.point,scale(hit.normal,.001));
    if(kind==='impact'){t.events.push({type:'contact',at:hitAge,position:[...t.position],normal:hit.normal});this.detonate(t,startTime+used);return;}
    t.velocity=scale(sub(t.velocity,scale(hit.normal,2*dot(t.velocity,hit.normal))),t.motion?.restitution??(kind==='kayo'?.6:1));
    if(kind==='kayo') {
      if(t.mechanic!=='underhand'){
        if(t.fuse-hitAge>.8+1e-9&&!t.bounceArmed){t.bounceArmed=true;this.emit({type:'bounce-arm',threat:t});}
        t.fuse=hitAge+bounceFuse(t.fuse-hitAge);
      }
      if(Math.abs(t.velocity[1])<.3&&hit.normal[1]===1)t.velocity[1]=0;
    }
    if(kind==='yoru'&&!t.bounced){t.fuse=hitAge+t.timing.windup;t.stage='armed';t.visible=true;}
    if(!t.bounced||Math.hypot(...t.velocity)>1)this.emit({type:'bounce',threat:t});
    t.events.push({type:'bounce',at:hitAge,position:[...t.position],normal:hit.normal});t.lastBounceAt=hitAge;t.bounced=true;
    this.projectile(t,dt-used,kind==='yoru'?0:gravity,kind,depth+1,hitAge,startTime+used);
  }
  detonate(t,at=this.time) {
    if(t.resolved)return;
    if(t.agent.id==='harbor') {
      const hit=Math.hypot(this.player[0]-t.position[0],this.player[2]-t.position[2])<3.5;
      this.finish(t,{outcome:hit?'hit':'evaded',success:!hit,label:hit?'涡流命中':'离开涡流',duration:hit?t.duration:0,angle:0,effect:'near',slow:hit});return;
    }
    const angle=angleTo(forward(this.yaw,this.pitch),this.player,t.position),blocked=occluded(this.player,t.position,this.map.boxes);
    const inCone=t.variant.id!=='clone'||dot(normalize(sub(this.player,t.position)),t.coneDirection||[0,0,1])>.5;
    const range=distance(this.player,t.position),exposure=flashExposure(angle,t.duration,blocked||!inCone,range,t.timing.profile);
    const success=blocked||!inCone||angle>=100;
    this.finish(t,{outcome:blocked?'cover':!inCone?'evaded':angle>=100?'turned':angle>=55?'partial':'hit',success,
      label:blocked?'掩体挡闪':!inCone?'避开锥形闪':angle>=100?'背闪成功':angle>=55?'背转不足':'正面吃闪',
      duration:exposure.duration,strength:exposure.strength,angle,range,exposureModel:exposure.model,effect:'flash',eventAt:at});
  }
  shoot() {
    if(!this.running||this.time-this.lastShot<.14)return false;this.lastShot=this.time;
    this.emit({type:'shot'});const t=this.threat;if(!t||t.dead||t.resolved)return false;
    const shootable=t.health>0&&(['vyse','gekko','reyna','fade'].includes(t.agent.id)||(t.agent.id==='yoru'&&t.stage==='clone'));
    if(!shootable)return false;
    const angle=angleTo(forward(this.yaw,this.pitch),this.player,t.position),radius=t.stage==='clone'?.65:.4;
    const blocked=occluded(this.player,t.position,this.map.boxes);
    if(blocked||Math.sin(angle*Math.PI/180)*distance(this.player,t.position)>radius||angle>=90)return false;
    t.health--;this.emit({type:'hit',threat:t});
    if(t.health<=0) {
      if(t.stage==='clone'){t.stage='triggered';t.fuse=t.age+t.timing.windup;t.coneDirection=normalize(sub(this.player,t.position));this.emit({type:'clone',threat:t});}
      else if(t.agent.id==='gekko'&&t.stage==='plasma'){t.visible=false;t.health=0;/* Already launched plasma remains independent. */}
      else {t.dead=true;if(t.agent.id==='reyna')this.effect=null;this.finish(t,{outcome:'destroyed',success:true,label:'击毁技能',duration:0,angle});}
    }
    return true;
  }
  finish(t,result) {
    if(t.resolved)return;t.resolved=true;
    const at=result.eventAt??this.time;
    const record={...result,agent:t.agent.name,variant:t.variant.name,round:this.round,at,reactionMs:t.reaction===null?null:Math.round(t.reaction),
      turnAngle:angleTo(forward(this.yaw,this.pitch),[0,0,0],t.initialLook),initialLook:t.initialLook,returnMs:null,seen:t.seenAt!==null,
      approximate:true,patch:PATCH,revision:SIMULATION_REVISION,platform:'pc-global',profileReference:t.timing.profile?.reference??'',mode:this.settings.mode,arena:this.settings.arena};
    this.results.push(record);this.lastResult=record;this.phase='recovery';
    this.recoverUntil=this.time+Math.max(1.3,result.noAfterEffect?0:result.duration+.6);
    if(result.duration>0&&!result.noAfterEffect)this.effect={type:result.effect||'flash',agent:t.agent.id,position:[...t.position],at,until:at+result.duration,duration:result.duration,strength:result.strength??1,slow:result.slow};
    this.emit({type:'result',result:record,threat:t});
  }
}
