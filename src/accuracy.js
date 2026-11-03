import { AGENTS, PATCH } from './data.js';

export const profileKey=(agent,variant)=>`${agent}/${variant}`;
export const skyeDuration=flight=>1+1.25*Math.max(0,Math.min(1,flight/.75));

export function resolveTiming(agent,variant,settings={}) {
  const profile=settings.calibrations?.[profileKey(agent.id,variant.id)];
  const timing={windup:variant.windup,duration:variant.duration,flightTime:variant.flightTime};
  if(agent.id==='hush') {
    timing.windup=settings.hushFuse??timing.windup;
    timing.duration=settings.hushDuration??timing.duration;
  }
  if(profile)Object.assign(timing,profile.timing);
  if(agent.id==='skye') {
    timing.flightTime=Math.min(timing.flightTime,2);
    if(!profile?.timing?.duration)timing.duration=skyeDuration(timing.flightTime);
  }
  return {...timing,profile};
}

// User measurements remain explicitly unverified. Import only a small, projected
// schema so malformed files cannot silently replace arbitrary application state.
export function validateProfile(input) {
  if(!input||input.schema!==1||input.patch!==PATCH||input.platform!=='pc-global')throw new Error(`需要 schema 1、国际服 PC ${PATCH} 的校准文件。`);
  const agent=AGENTS.find(a=>a.id===input.agent),variant=agent?.variants.find(v=>v.id===input.variant);
  if(!variant)throw new Error('未知的特工或投法。');
  if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.length>500)throw new Error('请填写录像名称、帧率、测量口径等来源备注（最多 500 字）。');
  const timing={};
  for(const key of ['windup','duration','flightTime']) {
    const value=input.timing?.[key];if(value===undefined)continue;
    const upper=key==='flightTime'?2:5;
    if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>upper)throw new Error(`${key} 必须大于 0 且不超过 ${upper} 秒。`);
    if(key==='flightTime'&&agent.id!=='skye')throw new Error('只有 Skye 接受单列飞行时间。');
    timing[key]=value;
  }
  if(agent.id==='reyna'&&(timing.duration??variant.duration)<=(timing.windup??variant.windup))throw new Error('眼球总存续时间必须大于生效前摇。');
  const samples=input.samples??[];
  if(!Array.isArray(samples)||samples.length>200)throw new Error('角度采样必须是数组，最多 200 行。');
  if(samples.length&&agent.kind!=='flash')throw new Error('角度衰减采样只适用于方向性闪光。');
  const rows=samples.map(s=>{
    if(!s||!['angle','distance','duration'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])))throw new Error('每行需填写 angle、distance、duration 数值；模板的 null 必须换成实测值。');
    if(s.angle<0||s.angle>180||s.distance<=0||s.distance>100||s.duration<0||s.duration>5)throw new Error('采样范围：角度 0–180°、距离 (0,100] 米、时长 0–5 秒。');
    return {angle:s.angle,distance:s.distance,duration:s.duration};
  }).sort((a,b)=>a.distance-b.distance||a.angle-b.angle);
  let signature;
  for(const distance of [...new Set(rows.map(r=>r.distance))]) {
    const group=rows.filter(r=>r.distance===distance),angles=group.map(r=>r.angle);
    if(angles.length<2||angles[0]!==0||angles.at(-1)!==180||new Set(angles).size!==angles.length)throw new Error('每个距离需要 0° 与 180° 端点，且角度不能重复。');
    const current=angles.join(',');if(signature&&signature!==current)throw new Error('各距离必须使用相同的角度采样网格。');signature=current;
  }
  if(!Object.keys(timing).length&&!rows.length)throw new Error('至少提供一个时序值或一组衰减采样。');
  return {schema:1,platform:'pc-global',patch:PATCH,agent:agent.id,variant:variant.id,reference:input.reference.trim(),timing,samples:rows};
}

export function sanitizeProfiles(input) {
  const result={};if(!input||typeof input!=='object')return result;
  for(const value of Object.values(input).slice(0,64)) {
    try{const profile=validateProfile(value);result[profileKey(profile.agent,profile.variant)]=profile;}catch{/* Invalid or old-patch profiles are not applied. */}
  }
  return result;
}

// Bilinear interpolation only inside measured distances. Outside, deliberately
// fall back to the labeled approximation instead of inventing extrapolated data.
export function sampleExposure(profile,angle,distance) {
  const rows=profile?.samples;if(!rows?.length)return null;
  const distances=[...new Set(rows.map(r=>r.distance))];
  if(distance<distances[0]-1e-6||distance>distances.at(-1)+1e-6)return null;
  const atDistance=d=>{
    const group=rows.filter(r=>r.distance===d);
    const upper=group.findIndex(r=>r.angle>=angle);
    if(upper<=0)return group[0].duration;
    const a=group[upper-1],b=group[upper],u=(angle-a.angle)/(b.angle-a.angle);
    return a.duration+(b.duration-a.duration)*u;
  };
  const upper=distances.findIndex(d=>d>=distance-1e-6);
  if(upper<=0)return atDistance(distances[0]);
  const lo=distances[upper-1],hi=distances[upper],u=(distance-lo)/(hi-lo);
  return atDistance(lo)+(atDistance(hi)-atDistance(lo))*u;
}

export function framesToSeconds(start,end,fps) {
  if(![start,end,fps].every(Number.isFinite)||start<0||end<=start||fps<=0||fps>1000)throw new Error('终止帧须晚于起始帧，帧率须为 0–1000 之间的正数。');
  return (end-start)/fps;
}
