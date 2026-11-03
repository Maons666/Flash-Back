export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const add = (a,b) => a.map((v,i) => v+b[i]);
export const sub = (a,b) => a.map((v,i) => v-b[i]);
export const scale = (a,s) => a.map(v => v*s);
export const dot = (a,b) => a.reduce((n,v,i) => n+v*b[i],0);
export const length = a => Math.hypot(...a);
export const distance = (a,b) => length(sub(a,b));
export const normalize = a => scale(a, 1/(length(a)||1));
export const lerp = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
export const forward = (yaw,pitch=0) => [-Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch)];
export const angleTo = (look, from, to) => deg(Math.acos(clamp(dot(look,normalize(sub(to,from))),-1,1)));
export const yawDelta = (counts,sens,calibration=1) => rad(counts * .07 * sens * calibration);
export const cm360 = (sens,dpi,calibration=1) => 360*2.54/(dpi*sens*.07*calibration);
export const verticalFov = (horizontal=103,aspect=16/9) => deg(2*Math.atan(Math.tan(rad(horizontal)/2)/aspect));
export function inView(from,to,yaw,pitch,horizontal=103,aspect=16/9) {
  const delta=sub(to,from),depth=dot(delta,forward(yaw,pitch));
  if(depth<=0)return false;
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];
  const up=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)];
  const halfWidth=depth*Math.tan(rad(horizontal/2));
  return Math.abs(dot(delta,right))<=halfWidth&&Math.abs(dot(delta,up))<=halfWidth/aspect;
}

// Segment/AABB slab intersection, including thin walls and an origin inside a box.
export function segmentBox(from,to,box,padding=0) {
  let near=0, far=1, normal=[0,0,0];
  for(let i=0;i<3;i++) {
    const lo=box.min[i]-padding, hi=box.max[i]+padding, delta=to[i]-from[i];
    if(Math.abs(delta)<1e-9) { if(from[i]<lo||from[i]>hi)return null; continue; }
    let t1=(lo-from[i])/delta, t2=(hi-from[i])/delta, sign=-1;
    if(t1>t2){[t1,t2]=[t2,t1];sign=1;}
    if(t1>near){near=t1;normal=[0,0,0];normal[i]=sign;}
    far=Math.min(far,t2);
    if(near>far)return null;
  }
  return {t:near,normal,point:lerp(from,to,near)};
}
export function trace(from,to,boxes,padding=0) {
  let closest=null;
  for(const box of boxes){const hit=segmentBox(from,to,box,padding);if(hit&&(!closest||hit.t<closest.t))closest={...hit,box};}
  return closest;
}
export const occluded = (from,to,boxes) => Boolean(trace(from,to,boxes));
export function movePlayer(position,delta,boxes,radius=.28) {
  const result=[...position];
  // Split large steps to prevent tunneling; slide along each horizontal axis.
  const steps=Math.max(1,Math.ceil(Math.hypot(delta[0],delta[2])/.12));
  for(let s=0;s<steps;s++) for(const axis of [0,2]) {
    const next=[...result]; next[axis]+=delta[axis]/steps;
    const blocked=boxes.some(b=>b.max[1]>.2 && next[0]>b.min[0]-radius&&next[0]<b.max[0]+radius&&next[2]>b.min[2]-radius&&next[2]<b.max[2]+radius);
    if(!blocked)result[axis]=clamp(next[axis],-13.6,13.6);
  }
  return result;
}
// Explicit training approximation. Riot does not publish the flash falloff curve.
export function flashExposure(angle, maxDuration, blocked=false, range=10,profile=null) {
  if(blocked)return {duration:0,strength:0,model:'occluded'};
  const measured=sampleExposure(profile,angle,range);
  if(measured!==null)return {duration:measured,strength:measured>0?clamp(measured/maxDuration,.04,1):0,model:'user-samples'};
  const factor=angle<=45?1:angle<100?1-(angle-45)/55*.87:.13-(angle-100)/80*.08;
  const distFactor=range<=25?1:clamp(1-(range-25)/60,.25,1);
  return {duration:maxDuration*factor*distFactor,strength:clamp(factor*distFactor,.04,1),model:profile?.samples?.length?'outside-samples':'approximation'};
}
export const bounceFuse = (remaining) => Math.min(remaining,.8);
import { sampleExposure } from './accuracy.js';

