import {add,sub,scale,dot,normalize,distance,lerp,clamp,trace,inView} from './math.js';

// Public community measurements are a starting point, not Riot certification.
// Gravity conversion and restitution still require local recording calibration.
export const MOTION_DEFAULTS={kayo:{speed:18,gravity:2.94,restitution:.6},skye:{speed:18,gravity:0,restitution:0},yoru:{speed:29,gravity:4.41,restitution:1},hush:{speed:18,gravity:2.94,restitution:0},gekko:{speed:18,gravity:2.94,restitution:.5}};
export function motionFor(agent,variant,profile){
  const base={...(MOTION_DEFAULTS[agent.id]||{speed:10,gravity:0,restitution:.6})};
  if(agent.id==='kayo'&&(variant.mechanic||variant.id)==='underhand')base.speed=6.3;
  return {...base,...profile?.motion};
}
export function freePoint(point,boxes,fallback,radius=.16){
  const valid=p=>p[0]>-23.7&&p[0]<23.7&&p[2]>-35.7&&p[2]<15.7&&p[1]>.15&&!trace(p,p,boxes,radius);
  if(valid(point))return [...point];
  for(let i=1;i<=80;i++){const p=lerp(point,fallback,i/80);if(valid(p))return p;}
  return [...fallback];
}
export function wallFace(player,dir,right,side,boxes,height=1.7,lateral=6){
  return wallFaces(player,dir,right,side,boxes,height,lateral)[0]||null;
}
function wallFaces(player,dir,right,side,boxes,height,lateral){
  const aim=add(player,add(scale(dir,7),scale(right,side*lateral)));aim[1]=height;
  const faces=[];
  for(const box of boxes)for(const axis of [0,2])for(const sign of [-1,1]){
    const normal=[0,0,0];normal[axis]=sign;
    const point=aim.map((n,i)=>clamp(n,box.min[i]+.22,box.max[i]-.22));
    point[1]=clamp(height,.35,box.max[1]-.2);point[axis]=(sign<0?box.min:box.max)[axis]+sign*.14;
    if(dot(sub(player,point),normal)<.1||trace(player,point,boxes,.04))continue;
    const ahead=dot(sub(point,player),dir);if(ahead<.4)continue;
    const view=dot(normalize(sub(point,player)),dir);
    const score=distance(point,aim)+Math.max(0,distance(player,point)-18)*2+(view<.62?70:0);
    faces.push({point,normal,box,score});
  }
  return faces.sort((a,b)=>a.score-b.score);
}
export function bankThrow(player,dir,right,side,boxes,speed,gravity,height=1.8,goalDistance=3.5,postFlight=0){
  for(const face of wallFaces(player,dir,right,side,boxes,height,8)){
  const goal=add(player,scale(dir,goalDistance)),out=normalize(sub(goal,face.point));out[1]=0;
  const incoming=normalize(sub(out,scale(face.normal,2*dot(out,face.normal))));
  if(dot(incoming,face.normal)>=0)continue;
  const flight=.28,vy=(face.point[1]-1.6+.5*gravity*flight*flight)/flight;
  const horizontal=Math.sqrt(Math.max(4,speed*speed-vy*vy));
  const velocity=add(scale(incoming,horizontal),[0,vy,0]);
  const impact=add(face.point,scale(face.normal,-.06));
  const origin=sub(impact,add(scale(velocity,flight),[0,-.5*gravity*flight*flight,0]));
  if(trace(origin,origin,boxes,.12)||origin[1]<.4)continue;
  const hit=trace(origin,add(impact,scale(face.normal,-.2)),boxes,.08);
  if(!hit||hit.box!==face.box)continue;
  if(postFlight){
    const atContact=add(velocity,[0,-gravity*flight,0]),reflected=sub(atContact,scale(face.normal,2*dot(atContact,face.normal)));
    const after=add(impact,scale(face.normal,.01)),end=add(after,scale(reflected,postFlight));
    if(trace(after,end,boxes,.08)||trace(player,end,boxes)||dot(normalize(sub(end,player)),dir)<.7)continue;
  }
  return {origin,velocity,face};
  }
  return null;
}
function curveballPlan(t,game){
  const {variant,dir,right,side}=t,player=game.player,boxes=game.map.boxes,height=variant.height??1.8;
  const wanted=(variant.mechanic||variant.id)==='left'?-1:1;
  let best;
  for(const box of boxes)for(const axis of [0,2])for(const sign of [-1,1])for(const edgeSign of [-1,1]){
    if(box.max[axis]-box.min[axis]>2.5)continue;
    const other=axis===0?2:0,normal=[0,0,0],tangent=[0,0,0];normal[axis]=sign;tangent[other]=edgeSign;
    const edge=[0,height,0];edge[axis]=(sign<0?box.min:box.max)[axis]+sign*.14;edge[other]=(edgeSign<0?box.min:box.max)[other]+edgeSign*.55;
    if(dot(sub(player,edge),normal)<=0||distance(player,edge)>18)continue;
    const start=add(edge,add(scale(tangent,variant.id==='reverse'?-2.2:-1.6),scale(normal,-1.4)));
    const control=add(edge,add(scale(tangent,1.2),scale(normal,-1.6))),end=add(edge,scale(normal,.8));
    const u=sub(control,start),v=sub(end,control),turn=u[2]*v[0]-u[0]*v[2];
    if(Math.sign(turn)!==wanted||!inView(player,end,game.yaw,game.pitch)||trace(player,end,boxes,.03)||trace(start,start,boxes,.1))continue;
    let previous=start,clear=true;
    for(let i=1;i<=60;i++){const f=i/60,next=add(add(scale(start,(1-f)**2),scale(control,2*f*(1-f))),scale(end,f*f));if(trace(previous,next,boxes,.09)){clear=false;break;}previous=next;}
    if(!clear)continue;
    const score=distance(player,end)+(dot(sub(end,player),right)*side<0?4:0)+(trace(player,start,boxes)?0:3);
    if(!best||score<best.score)best={start,control,end,score};
  }
  return best;
}
function routeFromPoints(points){
  const samples=[points[0]];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    for(let j=1;j<=48;j++){
      const u=j/48,u2=u*u,u3=u2*u;
      samples.push(b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*u+(2*a[k]-5*v+4*c[k]-d[k])*u2+(-a[k]+3*v-3*c[k]+d[k])*u3)));
    }
  }
  let total=0;const lengths=[0];for(let i=1;i<samples.length;i++){total+=distance(samples[i-1],samples[i]);lengths.push(total);}
  return {samples,lengths,length:total};
}
export function sampleRoute(route,travel){
  if(travel>route.length){const last=route.samples.at(-1),direction=normalize(sub(last,route.samples.at(-2)));return {position:add(last,scale(direction,travel-route.length)),direction};}
  const d=clamp(travel,0,route.length);let lo=0,hi=route.lengths.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(route.lengths[mid]<d)lo=mid;else hi=mid;}
  const a=route.samples[lo],b=route.samples[hi];
  return {position:lerp(a,b,(d-route.lengths[lo])/(route.lengths[hi]-route.lengths[lo]||1)),direction:normalize(sub(b,a))};
}
export function birdRoute(player,dir,right,side,variant,flight,speed,boxes){
  const mode=variant.route||'straight',goal=add(player,add(scale(dir,mode==='dive'?8:5),scale(right,side*1.7)));goal[1]=mode==='dive'?2.4:1.85;
  const length=speed*flight;
  if(mode==='curve'){
    const face=wallFace(player,dir,right,side,boxes,1.85,6);
    if(face&&distance(face.point,player)<18){
      const axis=face.normal[0]?2:0;
      const edges=[face.box.min[axis]-.65,face.box.max[axis]+.65].sort((a,b)=>Math.abs(a-player[axis])-Math.abs(b-player[axis]));
      for(const edgeValue of edges){
        const edge=[...face.point];edge[axis]=edgeValue;
        const behind=add(edge,scale(face.normal,-2)),front=add(edge,scale(face.normal,1));
        const sign=edgeValue<face.box.min[axis]?1:-1;
        let lo=.1,hi=length,route;
        for(let i=0;i<24;i++){const extra=(lo+hi)/2,start=[...behind];start[axis]+=sign*extra;route=routeFromPoints([start,behind,edge,front,goal]);if(route.length>length)hi=extra;else lo=extra;}
        const start=route.samples[0];
        if(distance(start,freePoint(start,boxes,player))>.01||!trace(player,start,boxes,.01))continue;
        if(route.samples.slice(1).every((p,i)=>!trace(route.samples[i],p,boxes,.12)))return route;
      }
    }
  }
  let shape=mode==='curve'?[[.45,0,1],[.45,0,.65],[.1,0,.45],[0,0,0]]:mode==='sweep'?[[0,0,1],[.08,.02,.65],[-.1,.02,.22],[0,0,0]]:mode==='dive'?[[.05,.42,1],[.04,.42,.65],[.02,.18,.25],[0,0,0]]:[[0,0,1],[0,0,0]];
  let normalized=routeFromPoints(shape),factor=length/normalized.length;
  let points=shape.map(p=>add(goal,add(scale(right,p[0]*side*factor),add(scale(dir,p[2]*factor),[0,p[1]*factor,0]))));
  // Choose an open corridor or move the launch laterally; never teleport through a wall.
  let route=routeFromPoints(points),best=route,bestScore=Infinity;
  for(const offset of [0,side*2,-side*2,side*4,-side*4,side*6]){
    const candidate=routeFromPoints(points.map(p=>add(p,scale(right,offset))));
    const start=candidate.samples[0];if(distance(start,freePoint(start,boxes,player))>.01)continue;
    let hits=0;for(let i=1;i<candidate.samples.length;i++)if(trace(candidate.samples[i-1],candidate.samples[i],boxes,.1))hits++;
    const score=hits*100+Math.abs(offset);if(score<bestScore){bestScore=score;best=candidate;}if(!hits)break;
  }
  if(bestScore===Infinity){const start=freePoint(points[0],boxes,player);best=routeFromPoints([start,...points.slice(1)]);}
  return best;
}
export function planThreat(t,game){
  const {agent,variant,dir,right,side,timing}=t,player=game.player,boxes=game.map.boxes;
  const mechanic=variant.mechanic||variant.id;t.mechanic=mechanic;t.motion=motionFor(agent,variant,timing.profile);
  const m=t.motion;
  if(agent.id==='skye'){
    t.route=birdRoute(player,dir,right,side,variant,variant.flightTime,MOTION_DEFAULTS.skye.speed,boxes);t.position=[...t.route.samples[0]];t.start=[...t.position];t.direction=sampleRoute(t.route,0).direction;
    t.activateAt=timing.flightTime;t.fuse=t.activateAt+timing.windup;
  }
  if(agent.id==='kayo'){
    const pitch=(variant.pitch??(mechanic==='underhand'?16:5))*Math.PI/180;
    const horizontal=variant.id==='cross'?normalize(add(scale(dir,-1),scale(right,side*.3))):scale(dir,-1);
    t.velocity=add(scale(horizontal,m.speed*Math.cos(pitch)),[0,m.speed*Math.sin(pitch),0]);
    const target=add(player,add(scale(dir,variant.id==='sky'?12:4),scale(right,side*(variant.id==='cross'?2.5:1.8))));
    let flight=variant.windup;
    if(variant.id==='ground')flight=.9;
    const baseline=mechanic==='underhand'?6.3:18;
    t.position=sub(target,scale(add(scale(horizontal,baseline*Math.cos(pitch)),[0,baseline*Math.sin(pitch),0]),flight));t.position[1]=1.6;
    if(variant.id==='bounce'){
      const bank=bankThrow(player,dir,right,side,boxes,18,2.94);
      if(bank){t.position=bank.origin;t.velocity=scale(bank.velocity,m.speed/18);t.plannedContact=bank.face.point;}
      else t.planNote='当前站位无可用弹墙路线，使用上手抛投';
    }
    t.position=freePoint(t.position,boxes,add(player,scale(dir,2)));
  }
  if(agent.id==='yoru'&&mechanic==='bounce'){
    const bank=variant.id!=='ground'?bankThrow(player,dir,right,side,boxes,29,4.41,variant.id==='high'?3.5:1.8,12,.6):null;
    if(bank){t.position=bank.origin;t.velocity=scale(bank.velocity,m.speed/29);t.plannedContact=bank.face.point;}
    else{t.position=freePoint(add(player,add(scale(dir,28),scale(right,side*1.6))),boxes,player);t.position[1]=1.6;t.velocity=scale(add(scale(dir,-Math.cos(Math.PI/10)),[0,-Math.sin(Math.PI/10),0]),m.speed);if(variant.id!=='ground')t.planNote='当前站位无可用墙弹路线，使用地面反弹';}
    t.stage='unarmed';t.visible=false;t.fuse=Infinity;t.timeout=3;
  }
  if(['breach','vyse'].includes(agent.id)){
    const face=wallFace(player,dir,right,side,boxes,variant.height??1.7,variant.id==='offangle'?10:6);
    if(face){t.position=face.point;t.normal=face.normal;}
    if(agent.id==='vyse'&&variant.id==='delayed'){t.armAt=1.4;t.stage='dormant';t.fuse+=t.armAt;}
  }
  if(agent.id==='phoenix'){
    const corner=curveballPlan(t,game),end=corner?.end||[...t.position];end[1]=variant.height??1.8;
    const curve=mechanic==='left'?-1:1;
    t.origin=end;t.start=add(end,add(scale(right,-curve*(variant.id==='reverse'?2.2:1.4)),scale(dir,1.7)));
    t.start=corner?.start||freePoint(t.start,boxes,add(player,scale(dir,3)));t.control=corner?.control||add(end,scale(dir,2.4));t.position=[...t.start];
  }
  if(agent.id==='hush'){
    const target=add(player,add(scale(dir,4),scale(right,side*1.4)));target[1]=1.65;t.redirectAt=t.fuse*(variant.id==='late'?.68:.4);
    const baseRedirect=variant.windup*(variant.id==='late'?.68:.4),turn=add(target,scale(dir,18*(variant.windup-baseRedirect)));
    let start=add(target,scale(dir,18*variant.windup));
    if(mechanic==='redirect')start=add(turn,add(scale(dir,18*baseRedirect*.85),scale(right,side*18*baseRedirect*.53)));
    start[1]=variant.id==='high'?6:1.7;turn[1]=start[1];
    t.position=freePoint(start,boxes,player);
    t.velocity=mechanic==='redirect'?scale(normalize(sub(turn,t.position)),m.speed):scale(normalize(add(scale(dir,-1),[0,.07,0])),m.speed);
    if(mechanic==='impact'){
      const bank=bankThrow(player,dir,right,side,boxes,18,2.94,1.7);
      if(bank){t.position=bank.origin;t.velocity=scale(bank.velocity,m.speed/18);t.plannedContact=bank.face.point;}
    }
  }
  if(agent.id==='gekko'){
    const destination=add(player,add(scale(dir,variant.id==='high'?9:6),scale(right,side*1.7)));destination[1]=variant.id==='high'?5:2.6;
    const flight=variant.windup,vy=(destination[1]-1.6+.5*2.94*flight*flight)/flight;
    const horizontal=Math.sqrt(Math.max(1,18*18-vy*vy));
    const launch=add(destination,scale(dir,horizontal*flight));launch[1]=1.6;t.position=freePoint(launch,boxes,player);
    t.velocity=scale(add(scale(dir,-horizontal),[0,vy,0]),m.speed/18);
    if(variant.id==='bank'){const bank=bankThrow(player,dir,right,side,boxes,18,2.94,2.5);if(bank){t.position=bank.origin;t.velocity=scale(bank.velocity,m.speed/18);}}
  }
  if(agent.id==='reyna'){
    t.position[1]=variant.id==='high'?3.5:variant.id==='low'?.5:1.8;t.eyeTarget=[...t.position];t.eyeStart=add(t.position,scale(dir,3));t.position=[...t.eyeStart];
  }
  if(['omen','fade'].includes(agent.id)&&variant.id==='cross'){
    t.position=add(player,add(scale(dir,8),scale(right,side*7)));t.position[1]=agent.id==='fade'?.65:1.65;
    if(agent.id==='omen')t.velocity=scale(normalize(sub(add(player,scale(dir,1)),t.position)),20);
    else t.position=freePoint(t.position,boxes,[player[0],.65,player[2]],.35);
  }
  if(agent.id==='harbor'&&variant.id==='surge-lead')t.position=add(t.position,scale(dir,3));
  t.launchPosition=[...t.position];t.launchTarget=[...player];t.trail=[{position:[...t.position],at:0}];t.history=[[...t.position]];
}
