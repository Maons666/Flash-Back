import { OFFICIAL_ASSETS } from './official-assets.js';
import { TechniquePreview } from './preview.js';
import { motionFor } from './trajectories.js';
import { AGENTS, FLASH_AGENTS, DEFAULTS, SOURCES, getAgent, timingEvidence, PATCH } from './data.js';
import { resolveTiming, sanitizeProfiles, validateProfile, profileKey, framesToSeconds, skyeDuration } from './accuracy.js';
import { Trainer } from './engine.js';
import { TrainingScene } from './scene.js';
import { TrainingAudio } from './audio.js';
import { cm360, clamp, deg } from './math.js';
import { MAPS, makeMap } from './maps.js';

const $=id=>document.getElementById(id), settingsKey='flash-dodger.settings.v1',historyKey='flash-dodger.history.v1';
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
const settings={...DEFAULTS,...load(settingsKey,{})};
settings.calibrations=sanitizeProfiles(settings.calibrations);
const numericLimits={sensitivity:[.001,10],dpi:[100,32000],calibration:[.5,2],interval:[1.5,6],rounds:[10,100],brightness:[.1,1],volume:[0,1],hushFuse:[.3,3],hushDuration:[.5,4]};
for(const [key,[min,max]] of Object.entries(numericLimits))settings[key]=Number.isFinite(Number(settings[key]))?clamp(Number(settings[key]),min,max):DEFAULTS[key];
for(const key of ['random','mixVariants','coach','raw'])settings[key]=settings[key]===true;
settings.agent=getAgent(settings.agent).id;
if(!['stationary','roam','corner'].includes(settings.mode))settings.mode='stationary';
if(!MAPS.some(m=>m.id===settings.arena))settings.arena='corner';
if(!['left','right','random'].includes(settings.side))settings.side='random';
settings.custom=Array.isArray(settings.custom)?settings.custom.filter(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=12)).slice(0,40):[];
let archive=load(historyKey,[]);if(!Array.isArray(archive))archive=[];archive=archive.filter(r=>r&&Number.isFinite(r.round)&&typeof r.agent==='string').slice(-200);
let scene,game,filter='flash',calibrating=false,calibrationYaw=0,notifyTimer,hitUntil=0,lastFps=0,frames=0,rawStatus='等待鼠标捕获',draftCustom=[];
const audio=new TrainingAudio(settings);
const glyphs={hush:'M5 16 16 4 27 16 16 28Z M10 16h12M16 10v12',phoenix:'M17 3c4 8-6 9 2 14 3-3 4-4 4-7 9 11 2 19-7 19S3 20 8 14c1 5 3 6 5 5-3-7 2-9 4-16Z',breach:'M6 8h20v16H6ZM3 13h26M3 19h26M12 5v22M20 5v22',skye:'M3 9 14 14 16 5 18 14 29 9 23 19 18 20 16 28 14 20 9 19Z',kayo:'M9 4h14v24H9ZM12 9h8M12 14h8M12 19h8M6 10H3m3 12H3m23-12h3m-3 12h3',yoru:'M5 5 13 10 16 4 19 10 27 5 25 21 16 28 7 21ZM10 14l4 3m8-3-4 3M13 22h6',vyse:'M16 3 19 10 27 7 23 15 29 19 21 21 20 29 15 23 8 28 9 20 2 16 10 13 8 5ZM12 16a4 4 0 1 0 8 0 4 4 0 1 0-8 0',gekko:'M4 17c0-9 6-13 12-13s12 4 12 13-7 11-12 11S4 26 4 17ZM10 15a6 6 0 1 0 12 0 6 6 0 1 0-12 0M16 12v6',reyna:'M2 16Q16-3 30 16 16 35 2 16ZM10 16a6 6 0 1 0 12 0 6 6 0 1 0-12 0',omen:'M4 26 7 8 16 3 25 8 28 26 16 21ZM11 12v6m5-8v10m5-8v6',fade:'M4 6 12 10 16 4 20 10 28 6 25 23 16 29 7 23ZM10 16l4 2m8-2-4 2',harbor:'M3 12q6-8 13 0t13 0M3 20q6-8 13 0t13 0M3 28q6-8 13 0t13 0'};
const icon=id=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${glyphs[id]}"/></svg>`;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message){$('notification').textContent=message;$('notification').hidden=false;clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>$('notification').hidden=true,3600);}
function persist(){try{localStorage.setItem(settingsKey,JSON.stringify(settings));$('save-status').textContent='设置保存在本机';}catch{$('save-status').textContent='设置保存失败';}}
function saveHistory(){try{localStorage.setItem(historyKey,JSON.stringify(archive));}catch{notify('本机记录暂时无法保存，可使用 CSV 导出。');}}
function resetSession(){
  if(document.pointerLockElement)document.exitPointerLock();
  calibrating=false;document.body.classList.remove('calibrating');game.reset();scene?.rebuild();$('result-toast').hidden=true;
  updateOverlay();updateStats();renderHud();
}
function renderAgents(){
  const list=AGENTS.filter(a=>(a.kind==='nearsight')===(filter==='near'));
  $('agent-count').textContent=`${String(list.length).padStart(2,'0')} AGENTS`;
  $('agents').innerHTML=list.map(a=>`<button class="agent-button ${settings.agent===a.id?'selected':''}" data-agent="${a.id}" style="--agent:${a.color}" title="${a.zh} · ${a.skill}" aria-pressed="${settings.agent===a.id}"><span class="agent-symbol">${OFFICIAL_ASSETS[a.id]?.portrait?`<img class="agent-portrait" src="./${OFFICIAL_ASSETS[a.id].portrait}" alt="${a.name}">`:icon(a.id)}</span><span class="agent-label">${a.name}</span></button>`).join('');
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter===filter));
}
function renderAbility(){
  const a=getAgent(settings.agent);let v=a.variants.find(v=>v.id===settings.variant)||a.variants[0];settings.variant=v.id;
  $('ability-name').textContent=a.skill;$('ability-tag').textContent=a.tag?`V${a.tag}`:a.kind==='nearsight'?'近视':a.kind==='plasma'?'电浆':'FLASH';
  $('ability-description').textContent=a.description;$('counter').textContent=a.counter;
  $('variant').innerHTML=a.variants.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');$('variant').value=settings.variant;
  const skill=OFFICIAL_ASSETS[a.id]?.abilities?.find(s=>s.key===(v.id==='clone'?'clone':a.id==='harbor'&&(v.mechanic||v.id)==='wave'?'wave':'flash'));
  $('ability-icon').hidden=!skill;if(skill)$('ability-icon').src='./'+skill.icon;
  const timing=resolveTiming(a,v,settings),labels=timingLabels(a,v);
  $('windup-label').textContent=labels[0];$('duration-label').textContent=labels[1];
  $('windup').textContent=timing.windup.toFixed(3)+' s';$('duration').textContent=timing.duration.toFixed(3)+' s';
  $('timing-evidence').innerHTML=evidenceHTML(a,v,timing);
  $('hush-tuning').hidden=a.id!=='hush'||Boolean(timing.profile);$('hud-agent').textContent=`${a.name.toUpperCase()} / ${a.skill.split(' · ')[0].toUpperCase()}`;
}
function timingLabels(a,v){return [a.id==='skye'?'激活后前摇':a.id==='breach'?'显现后前摇':a.id==='yoru'?(v.id==='clone'?'被击中后前摇':'反弹后前摇'):a.id==='kayo'||a.id==='hush'?'出手后引信':a.id==='gekko'?'部署形成':a.id==='reyna'?'生效前摇':'启动前摇',a.id==='reyna'?'眼球总存续':a.kind==='nearsight'?'近视时长':a.kind==='plasma'?'遮挡总时长':'正面最大时长'];}
const evidenceNames={official:'官方公告',derived:'规则推算',estimate:'待实测'};
function evidenceHTML(a,v,timing){
  const evidence=timingEvidence(a,v),labels=timingLabels(a,v);
  const rows=['windup','duration'].map((key,i)=>{
    const item=evidence[key],custom=timing.profile?.timing?.[key]!==undefined;
    const text=`${labels[i]}：${custom?'用户校准':evidenceNames[item.status]}`;
    return `<span title="${escapeHTML(custom?timing.profile.reference:item.note)}">${item.url&&!custom?`<a href="${item.url}" target="_blank" rel="noreferrer">${text} ↗</a>`:text}</span>`;
  });
  if(a.id==='skye')rows.push(`<span>激活前飞行 ${timing.flightTime.toFixed(3)} s · ${timing.profile?.timing?.flightTime!==undefined?'用户校准':'训练情景'}；总计 ${(timing.flightTime+timing.windup).toFixed(3)} s</span>`);
  rows.push(`<span>角度衰减：${timing.profile?.samples?.length?'用户采样插值（限采样距离）':'训练近似，待实测'}</span>`);
  return rows.join('');
}
function renderLibrary(){
  $('ability-library').innerHTML=AGENTS.map(a=>`<div class="library-row" style="--agent:${a.color}"><div><strong>${a.name}</strong><small>${a.zh} · ${a.kind==='flash'?'方向性闪光':a.kind==='plasma'?'电浆致盲':'近视'}</small></div><div><p>${a.description}</p><p>${a.counter}</p>${a.variants.map(v=>{const timing=resolveTiming(a,v,settings);return `<div class="library-times"><b>${v.name}</b> · ${timing.windup.toFixed(3)} / ${timing.duration.toFixed(3)} s<div class="timing-evidence">${evidenceHTML(a,v,timing)}</div></div>`;}).join('')}</div></div>`).join('');
}
function renderSettings(){
  for(const key of Object.keys(DEFAULTS)){const el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];}
  $('edpi').textContent=(settings.sensitivity*settings.dpi).toFixed(1).replace(/\.0$/,'');$('cm360').textContent=cm360(settings.sensitivity,settings.dpi,settings.calibration).toFixed(2);
  $('round-total').textContent=settings.rounds;
  $('calibration-summary').textContent=`${settings.dpi} DPI × ${settings.sensitivity}，理论 180° 距离 ${(cm360(settings.sensitivity,settings.dpi,settings.calibration)/2).toFixed(2)} 厘米。`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===settings.mode));
  $('mode-description').textContent={stationary:'专注视角反应，固定站位',roam:'移动中识别技能，利用掩体切断视线',corner:'走进地面的绿色触发圈，迎接下一闪'}[settings.mode];
  $('map-name').textContent=game.map.name;
  renderAgents();renderAbility();renderMaps();renderLibrary();persist();
}
function renderMaps(){
  const shapes={open:'M4 4h24v24H4Z M13 16h6m-3-3v6',corner:'M5 5v22h11M5 13h13M24 5v20h-7',boxes:'M4 7h9v9H4Zm15 10h9v9h-9Z',corridor:'M5 3v26M27 3v26M5 10h11M17 22h10'};
  $('map-options').innerHTML=MAPS.map(m=>`<button class="map-option ${settings.arena===m.id?'selected':''}" data-map="${m.id}" title="${m.sub}"><svg viewBox="0 0 32 32"><path d="${shapes[m.id]}"/></svg><span>${m.name}</span></button>`).join('');
}
function updateStats(){
  const list=game.results,valid=list.filter(r=>r.reactionMs!==null),returns=list.filter(r=>r.returnMs!==null);
  const mean=(arr,key)=>arr.length?Math.round(arr.reduce((s,r)=>s+r[key],0)/arr.length):'—';
  $('success-rate').innerHTML=`${list.length?Math.round(list.filter(r=>r.success).length/list.length*100):'—'}<small>%</small>`;
  $('reaction-stat').innerHTML=`${mean(valid,'reactionMs')}<small>ms</small>`;$('return-stat').innerHTML=`${mean(returns,'returnMs')}<small>ms</small>`;
  $('session-dots').innerHTML=Array.from({length:Math.min(settings.rounds,50)},(_,i)=>`<i class="${list[i]?(list[i].success?'good':'bad'):''}"></i>`).join('');
  const rows=archive.slice(-5).reverse();
  $('history').innerHTML=rows.length?rows.map(r=>`<tr><td>${String(r.round).padStart(2,'0')}</td><td>${escapeHTML(r.agent)} <span class="muted">/ ${escapeHTML(r.variant)}</span></td><td class="${r.success?'good':'bad'}">${escapeHTML(r.label)}</td><td>${r.reactionMs===null?'—':escapeHTML(r.reactionMs)+' ms'}</td><td>${Number(r.angle||0).toFixed(0)}°</td><td>${Number(r.duration||0).toFixed(2)} s</td><td>${r.returnMs===null?'—':escapeHTML(r.returnMs)+' ms'}</td></tr>`).join(''):'<tr class="empty-row"><td colspan="7">训练结束后，这里会记录每一次转身。</td></tr>';
  $('history-summary').textContent=list.length?`本组 ${list.length} / ${settings.rounds} · 本机保留最近 200 次`:archive.length?'上次保存在本机的训练记录':'等待第一轮闪光';
}
function onEvent(event){
  audio.event(event,game);scene?.onEvent(event);
  if(event.type==='spawn'){$('result-toast').hidden=true;}
  if(event.type==='hit'){hitUntil=game.time+.15;}
  if(event.type==='result') {
    archive.push(event.result);archive=archive.slice(-200);saveHistory();updateStats();
    $('result-toast').hidden=false;$('result-toast').classList.toggle('bad',!event.result.success);
    $('result-toast').querySelector('strong').textContent=event.result.label;
    $('result-toast').querySelector('span').textContent=`${event.result.agent} · ${event.result.reactionMs===null?'无可计反应':event.result.reactionMs+' ms'} · 致盲 ${event.result.duration.toFixed(2)} s`;
  }
  if(event.type==='return'){saveHistory();updateStats();}
  if(event.type==='complete'){document.exitPointerLock();updateOverlay();}
}
game=new Trainer(settings,onEvent);game.presentationTiming=true;
try{scene=new TrainingScene($('viewport'),game);$('system-info').textContent=`图形设备：${scene.gpu}。视野固定 103°，训练画面保持 16:9。首次开始后会显示原始输入请求结果；物理手感仍需用尺子核对。`;}
catch(error){$('fatal-error').hidden=false;$('fatal-error').textContent=`无法创建 3D 图形环境：${error.message}。请检查显卡驱动并重新启动。`;$('start-button').disabled=true;}

function updateOverlay(){
  $('start-overlay').hidden=game.running;
  document.body.classList.toggle('running',game.running);
  const complete=game.phase==='complete',paused=game.phase!=='ready';
  $('overlay-kicker').textContent=complete?'本组训练完成':paused?'随时回到这一轮':'准备好你的下一次反应';
  $('overlay-title').textContent=complete?'每一次转身，都算数。':paused?'训练已暂停。':'背身，躲过这一闪。';
  $('overlay-description').innerHTML=complete?`完成 ${game.results.length} 次，规避成功 ${game.results.filter(r=>r.success).length} 次。<br>复盘下方记录，或继续下一组。`:paused?'时间和技能已暂停。<br>点击继续，重新捕获鼠标。':'识别技能出手，快速转身。<br>闪光爆开后，把准星拉回原位。';
  $('start-button').innerHTML=`${complete?'再来一组':paused?'继续训练':'开始训练'} <span>→</span>`;
}
async function start(calibrate=false){
  if(!scene)return;
  calibrating=calibrate;document.body.classList.toggle('calibrating',calibrating);
  if(calibrate){game.reset();game.phase='calibration';calibrationYaw=game.yaw;}
  $('start-button').disabled=true;
  try{
    // Request pointer lock in the original user-gesture task. Waiting for the
    // audio device first can consume transient activation on a cold launch.
    audio.start().catch(()=>notify('声音设备暂不可用，训练仍可继续。'));
    try{await scene.renderer.domElement.requestPointerLock({unadjustedMovement:true});rawStatus='原始输入 · 已请求';}
    catch(error){if(error.name==='NotSupportedError'){await scene.renderer.domElement.requestPointerLock();rawStatus='兼容输入 · 需距离校准';notify('当前环境不支持原始输入，请在操作与校准中核对转身距离。');}else throw error;}
    if(document.pointerLockElement){previous=performance.now();game.start();updateOverlay();}
  }catch(error){notify(`无法捕获鼠标：${error.message}。请再次点击开始。`);game.pause();updateOverlay();}
  finally{$('start-button').disabled=false;}
}
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===scene?.renderer.domElement){previous=performance.now();game.start();updateOverlay();}
  else {
    if(calibrating){const rotation=Math.abs(deg(game.yaw-calibrationYaw));$('calibration-reading').textContent=`上次校准转过 ${rotation.toFixed(1)}°；目标为 180°。`;calibrating=false;document.body.classList.remove('calibrating');game.reset();}
    game.pause();audio.pause();updateOverlay();
  }
});
document.addEventListener('mousemove',event=>{if(document.pointerLockElement){advanceTo(performance.now());game.look(event.movementX,event.movementY);}});
document.addEventListener('keydown',event=>{
  if(!document.pointerLockElement)return;
  advanceTo(performance.now());
  if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ControlLeft','Space'].includes(event.code)){event.preventDefault();game.keys.add(event.code);}
  if(event.code==='KeyR'&&!event.repeat){game.player=[...game.map.spawn];game.yaw=0;game.pitch=0;if(game.threat&&!game.threat.resolved)game.round--;game.threat=null;game.effect=null;if(!calibrating)game.queueRound();$('result-toast').hidden=true;}
});
document.addEventListener('keyup',event=>{if(document.pointerLockElement)advanceTo(performance.now());game.keys.delete(event.code);});
$('viewport').addEventListener('mousedown',event=>{if(event.button===0&&document.pointerLockElement){advanceTo(performance.now());game.shoot();}});
window.addEventListener('blur',()=>{if(game.running){game.pause();if(document.pointerLockElement)document.exitPointerLock();updateOverlay();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.running){game.pause();document.exitPointerLock();updateOverlay();}});
$('start-button').addEventListener('click',()=>start());
$('reset-button').addEventListener('click',()=>{resetSession();notify('已开始新的一组，历史记录仍保留在本机。');});
$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage-frame').requestFullscreen();}catch(error){notify(error.message);}});
$('home-button').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
for(const [button,dialog] of [['library-button','library-dialog'],['accuracy-button','library-dialog'],['help-button','help-dialog'],['calibrate-button','help-dialog']])$(button).addEventListener('click',()=>$(dialog).showModal());
document.querySelectorAll('.close-button').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
$('calibration-run').addEventListener('click',()=>{$('help-dialog').close();start(true);});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;renderAgents();}));
$('agents').addEventListener('click',event=>{const button=event.target.closest('[data-agent]');if(!button)return;settings.agent=button.dataset.agent;settings.variant=getAgent(settings.agent).variants[0].id;settings.random=false;resetSession();renderSettings();});
$('modes').addEventListener('click',event=>{const button=event.target.closest('[data-mode]');if(!button)return;settings.mode=button.dataset.mode;resetSession();renderSettings();});
$('map-options').addEventListener('click',event=>{const button=event.target.closest('[data-map]');if(!button)return;settings.arena=button.dataset.map;settings.custom=[];resetSession();renderSettings();});
for(const key of Object.keys(DEFAULTS)){
  const el=$(key);if(!el)continue;
  el.addEventListener('change',()=>{
    if(el.type==='checkbox')settings[key]=el.checked;
    else if(key in numericLimits){const n=Number(el.value);if(!Number.isFinite(n)||el.value===''){el.value=settings[key];return;}settings[key]=clamp(n,...numericLimits[key]);}
    else settings[key]=el.value;
    if(!['sensitivity','dpi','calibration','brightness','volume','coach'].includes(key))resetSession();
    renderSettings();
  });
}
$('sources').innerHTML=SOURCES.map(s=>`<a href="${s.url}" target="_blank" rel="noreferrer">${s.title} ↗</a>`).join('');

function fillMeasurements(){
  const a=getAgent(settings.agent),v=a.variants.find(v=>v.id===settings.variant),t=resolveTiming(a,v,settings);
  const labels=timingLabels(a,v),e=timingEvidence(a,v);
  $('measurement-title').textContent=`${a.name} · ${v.name}`;
  $('measurement-windup-label').textContent=`${labels[0]} / 秒`;$('measurement-duration-label').textContent=`${labels[1]} / 秒`;
  $('measurement-windup').value=t.windup;$('measurement-duration').value=t.duration;$('measurement-flight').value=t.flightTime??1;
  $('measurement-flight-field').hidden=a.id!=='skye';
  const supported=['kayo','skye','yoru','hush','gekko'].includes(a.id),motion=motionFor(a,v,t.profile);
  $('measurement-motion').hidden=!supported;
  for(const key of ['speed','gravity','restitution'])$('motion-'+key).value=motion[key];
  $('motion-gravity').disabled=a.id==='skye';$('motion-restitution').disabled=a.id==='skye';
  $('measurement-reference').value=t.profile?.reference??'';
  $('measurement-samples').value=t.profile?.samples.map(s=>`${s.angle}, ${s.distance}, ${s.duration}`).join('\n')??'';
  $('measurement-samples').disabled=a.kind!=='flash';
  $('measurement-sources').innerHTML=evidenceHTML(a,v,t)+`<p>${escapeHTML(e.windup.note)}；${escapeHTML(e.duration.note)}。</p>`;
  $('measurement-error').textContent='';updateFrameConversion();
}
function updateFrameConversion(){
  try{const fps=Number($('measure-fps').value),seconds=framesToSeconds(Number($('measure-start').value),Number($('measure-end').value),fps);$('measurement-conversion').textContent=`时长 ${seconds.toFixed(4)} 秒；每帧 ${(1000/fps).toFixed(2)} ms。两端各偏差 1 帧时，最坏误差约 ±${(2000/fps).toFixed(2)} ms。`;}
  catch(error){$('measurement-conversion').textContent=error.message;}
}
for(const id of ['measure-fps','measure-start','measure-end'])$(id).addEventListener('input',updateFrameConversion);
$('measurement-flight').addEventListener('change',()=>{$('measurement-duration').value=skyeDuration(Number($('measurement-flight').value)).toFixed(4);});
$('measurement-button').addEventListener('click',()=>{fillMeasurements();$('measurement-dialog').showModal();});
function readMeasurementForm(){
  const a=getAgent(settings.agent),timing={windup:Number($('measurement-windup').value),duration:Number($('measurement-duration').value)};
  if(a.id==='skye')timing.flightTime=Number($('measurement-flight').value);
  const raw=$('measurement-samples').value.trim();
  const samples=raw?raw.split(/\r?\n/).filter(s=>s.trim()).map(line=>{
    const cells=line.trim().split(/[,，]/);if(cells.length!==3||cells.some(c=>!c.trim()))throw new Error('每行需要三个已测数值，用逗号分隔。');
    return {angle:Number(cells[0]),distance:Number(cells[1]),duration:Number(cells[2])};
  }):[];
  const motion=['kayo','skye','yoru','hush','gekko'].includes(a.id)?Object.fromEntries(['speed','gravity','restitution'].map(key=>[key,Number($('motion-'+key).value)])):undefined;
  return validateProfile({schema:1,platform:'pc-global',patch:PATCH,agent:a.id,variant:settings.variant,reference:$('measurement-reference').value,timing,samples,...(motion?{motion}:{})});
}
function applyProfile(profile){
  settings.calibrations[profileKey(profile.agent,profile.variant)]=profile;settings.agent=profile.agent;settings.variant=profile.variant;
  filter=getAgent(profile.agent).kind==='nearsight'?'near':'flash';resetSession();renderSettings();fillMeasurements();notify('已应用用户校准；仅适用于记录的版本和测量范围。');
}
$('measurement-apply').addEventListener('click',()=>{try{applyProfile(readMeasurementForm());}catch(error){$('measurement-error').textContent=error.message;}});
$('measurement-restore').addEventListener('click',()=>{delete settings.calibrations[profileKey(settings.agent,settings.variant)];if(settings.agent==='hush'){settings.hushFuse=DEFAULTS.hushFuse;settings.hushDuration=DEFAULTS.hushDuration;}resetSession();renderSettings();fillMeasurements();notify('已恢复当前投法的默认值。');});
$('measurement-export').addEventListener('click',()=>{
  try{const profile=readMeasurementForm(),url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`FlashDodger-${profile.agent}-${profile.variant}-${PATCH}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  catch(error){$('measurement-error').textContent=error.message;}
});
$('measurement-import').addEventListener('click',()=>$('measurement-file').click());
$('measurement-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>100000)throw new Error('校准文件不得超过 100 KB。');applyProfile(validateProfile(JSON.parse(await file.text())));}
  catch(error){$('measurement-error').textContent=`导入失败：${error.message}`;}finally{event.target.value='';}
});

function drawEditor(){
  const c=$('map-editor'),ctx=c.getContext('2d'),size=c.width,unit=size/28;ctx.fillStyle='#15232b';ctx.fillRect(0,0,size,size);
  ctx.strokeStyle='#2a4046';ctx.lineWidth=1;for(let i=0;i<=14;i++){ctx.beginPath();ctx.moveTo(i*size/14,0);ctx.lineTo(i*size/14,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*size/14);ctx.lineTo(size,i*size/14);ctx.stroke();}
  const map=makeMap(settings.arena,[]);ctx.fillStyle='#5d7477';for(const b of map.boxes)ctx.fillRect((b.min[0]+14)*unit,(b.min[2]+14)*unit,(b.max[0]-b.min[0])*unit,(b.max[2]-b.min[2])*unit);
  ctx.fillStyle='#9bc8b0';for(const p of draftCustom)ctx.fillRect((p[0]+13)*unit+2,(p[1]+13)*unit+2,2*unit-4,2*unit-4);
  ctx.textAlign='center';ctx.font='12px Segoe UI';ctx.fillStyle='#edab8c';ctx.beginPath();ctx.arc(14*unit,23*unit,.55*unit,0,Math.PI*2);ctx.fill();ctx.fillText('出生点',14*unit,25*unit);
  for(const z of [6,1,-4,-9]){ctx.strokeStyle='#afd8c8';ctx.beginPath();ctx.arc(14*unit,(z+14)*unit,.75*unit,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#9cb8b5';ctx.fillText('前进方向 ↑',size/2,22);$('custom-count').textContent=`${draftCustom.length} 个自定义掩体`;
}
$('edit-map-button').addEventListener('click',()=>{draftCustom=settings.custom.map(p=>[...p]);drawEditor();$('map-dialog').showModal();});
$('map-editor').addEventListener('click',event=>{
  const rect=event.target.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*14)*2-13,z=Math.floor((event.clientY-rect.top)/rect.height*14)*2-13;
  const existing=draftCustom.findIndex(p=>p[0]===x&&p[1]===z);if(existing>=0){draftCustom.splice(existing,1);drawEditor();return;}
  if(Math.abs(x)>11||Math.abs(z)>11||Math.abs(x)<2&&[9,6,1,-4,-9].some(g=>Math.abs(g-z)<2)){notify('出生点和触发路径需要保持畅通。');return;}
  if(makeMap(settings.arena).boxes.some(b=>x+1>b.min[0]&&x-1<b.max[0]&&z+1>b.min[2]&&z-1<b.max[2])){notify('这里与现有墙体重叠。');return;}
  if(draftCustom.length>=40){notify('最多放置 40 个自定义箱体。');return;}
  draftCustom.push([x,z]);drawEditor();
});
$('clear-custom').addEventListener('click',()=>{draftCustom=[];drawEditor();});
$('apply-map').addEventListener('click',()=>{settings.custom=draftCustom.map(p=>[...p]);resetSession();persist();$('map-dialog').close();notify('场地已更新，自定义箱体参与移动碰撞和闪光遮挡。');});
$('export-button').addEventListener('click',()=>{
  if(!archive.length){notify('完成至少一轮训练后即可导出。');return;}
  const fields=['round','agent','variant','label','success','reactionMs','angle','range','duration','returnMs','mode','arena','approximate','patch','revision','platform','exposureModel','profileReference'];
  const csv='\uFEFF'+fields.join(',')+'\r\n'+archive.map(r=>fields.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='FlashDodger-training.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});

function renderHud(){
  $('round-number').textContent=String(game.round).padStart(2,'0');
  $('stage-state').textContent=calibrating?'距离校准':!game.running?'准备 / 暂停':game.phase==='waiting'?'等待出闪':game.phase==='threat'?'训练中':'回正准星';
  $('input-state').textContent=rawStatus;
  const t=game.threat,e=game.running?game.effect:null;
  $('hud-agent').textContent=settings.random&&(!t||!t.resolved)?'MIXED / 随机技能':`${(t?.agent.name||getAgent(settings.agent).name).toUpperCase()} / ${t?.variant.name||$('variant').selectedOptions[0]?.textContent||''}`;
  $('hud-hint').textContent=game.gate&&game.running?'走进绿色圆圈触发来闪':game.running?'Esc 暂停 · R 回到起点':'鼠标转向 · Esc 暂停';
  $('coach-cue').hidden=!calibrating&&!(settings.coach&&t&&!t.resolved);
  if(calibrating)$('coach-cue').textContent=`已转 ${Math.abs(deg(game.yaw-calibrationYaw)).toFixed(1)}° / 180° · Esc 结束校准`;
  else if(settings.coach&&t)$('coach-cue').textContent=Number.isFinite(t.fuse)?`引爆倒计时 ${Math.max(0,t.fuse-t.age).toFixed(2)} s`:'锁定 / 追踪机制';
  $('hit-marker').hidden=game.time>hitUntil;
  const remaining=e?Math.max(0,e.until-game.time):0,fade=e&&e.duration>0?Math.min(1,remaining/Math.min(e.duration*.45,.7)):0;
  $('flash-effect').style.opacity='0';
  $('plasma-effect').style.opacity='0';
  $('near-effect').style.opacity=e?.type==='near'?'.8':'0';
}
new TechniquePreview(settings);
renderSettings();updateStats();updateOverlay();
let previous=performance.now();
function advanceTo(now){
  const dt=Math.max(0,(now-previous)/1000);previous=Math.max(previous,now);
  if(!game.running)return;
  if(dt>.1){game.pause();if(document.pointerLockElement)document.exitPointerLock();updateOverlay();notify('检测到明显卡顿，已暂停本轮以避免计时失真。');return;}
  game.update(dt);
}
function frame(now){
  advanceTo(now);audio.update(game);scene?.render();if(game.running)game.markPresented();frames++;
  renderHud();
  if(now-lastFps>=1000){$('fps').textContent=`${Math.round(frames*1000/(now-lastFps))} FPS`;frames=0;lastFps=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
