export const VERIFIED_DATE = '2026-11-02';
export const PATCH = '13.09';
export const SIMULATION_REVISION = '0.10.0';
const official = slug => `https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-${slug}/`;
export const SOURCES = [
  { title:'13.09 · Hush 的转向、触碰与延时引爆机制', url:official('1309') },
  { title:'11.08 · Breach、KAY/O、Yoru、Vyse 时长与近视调整', url:official('11-08') },
  { title:'11.00 · Phoenix 前摇调整为 0.6 秒', url:official('11-00') },
  { title:'10.06 · KAY/O 上手闪反弹后 0.8 秒引爆', url:official('10-06') },
  { title:'5.07 · Skye 飞行蓄力与 KAY/O 上手闪', url:official('5-07') },
  { title:'7.12 · Dizzy 锁定前摇与弹速', url:official('7-12') },
  { title:'12.00 · Harbor 范围近视可穿掩体', url:official('12-00') },
  { title:'官方特工名册与技能机制', url:'https://playvalorant.com/en-us/agents/' },
  { title:'1.07 · Breach 显现后的 0.5 秒引爆前摇', url:official('1-07') },
  { title:'2.06 · Yoru 反弹后的 0.6 秒激活时间', url:official('2-06') },
  { title:'3.06 · Skye 激活前摇、KAY/O 末段提示与飞行声音', url:official('3-06') },
  { title:'社区参考 · Skye 飞行速度，非 Riot 官方参数', url:'https://wiki.playvalorant.com/en-us/Guiding_Light' },
  { title:'社区参考 · 投射物速度与重力分类，换算仍待实测', url:'https://wiki.playvalorant.com/en-us/Projectile' },
  { title:'7.04 / 8.01 · Skye 最长飞行 2 秒、到时自动激活', url:official('8-01') },
  { title:'7.04 · Skye 最长飞行时间', url:official('7-04') },
  { title:'9.08 · Dizzy 形成后的有效活动时间为 1 秒', url:official('9-08') },
  { title:'12.08 · Dizzy 不再只在目标头部可见时锁定', url:official('12-08') },
  { title:'5.01 · Phoenix 1.5 秒满闪', url:official('5-01') },
];

// Times in seconds, distances in meters. Unpublished simulation parameters are
// explicitly labeled in the UI and docs; these are not extracted Riot assets.
export const AGENTS = [
  { id:'hush', name:'Hush', zh:'Hush', short:'HU', color:'#e79ab9', skill:'Flashbulb', kind:'flash', tag:'13.09',
    description:'可在空中重新定向，接触表面或到时引爆。练习识别转向后的落点，而不是只盯着最初轨迹。',
    counter:'背转视角或切断爆点视线。', approximate:true,
    variants:[{id:'redirect',name:'空中转向',windup:1.15,duration:1.5},{id:'impact',name:'触碰引爆',windup:1.15,duration:1.5},{id:'delay',name:'延时引爆',windup:1.15,duration:1.5}] },
  { id:'phoenix', name:'Phoenix', zh:'不死鸟', short:'PH', color:'#ffad6c', skill:'Curveball · 曲线闪光', kind:'flash',
    description:'短距离固定弧线，向左或向右转弯，0.6 秒后爆开；正面最长致盲 1.5 秒。',counter:'在闪球出角时转身，爆开后拉回。',
    variants:[{id:'left',name:'左曲线',windup:.6,duration:1.5},{id:'right',name:'右曲线',windup:.6,duration:1.5}] },
  { id:'breach', name:'Breach', zh:'铁臂', short:'BR', color:'#d7aa6d', skill:'Flashpoint · 闪点爆破', kind:'flash',
    description:'穿墙施放，在墙体另一侧显现并爆开。闪光本身仍然需要爆点到玩家之间无遮挡。',counter:'识别墙上前摇，转身或退回墙后。',
    variants:[{id:'wall',name:'穿墙闪',windup:.5,duration:2.25}] },
  { id:'skye', name:'Skye', zh:'斯凯', short:'SK', color:'#a7c98d', skill:'Guiding Light · 引路之隼', kind:'flash',
    description:'飞行蓄力后激活，再经过 0.3 秒前摇引爆。飞行满 0.75 秒达到满闪；最长飞行 2 秒后自动激活。鹰不可射毁。',counter:'区分飞行与激活提示，在引爆前转身。',
    variants:[{id:'charged',name:'蓄力鸟闪',flightTime:1.25,windup:.3,duration:2.25},{id:'quick',name:'短飞行鸟闪',flightTime:.45,windup:.3,duration:1.75},{id:'auto',name:'到时自动鸟闪',flightTime:2,windup:.3,duration:2.25}] },
  { id:'kayo', name:'KAY/O', zh:'KAY/O', short:'KO', color:'#a1bafa', skill:'FLASH/drive · 闪存过载', kind:'flash',
    description:'上手长抛、下手短抛。上手闪碰撞后最多再等 0.8 秒，不延长原引信；两种投法满闪均为 2.25 秒。',counter:'注意弹跳声音，不能沿用旧版右键 1.5 秒时长。',
    variants:[{id:'overhand',name:'上手长抛',windup:1.6,duration:2.25},{id:'underhand',name:'下手短抛',windup:1,duration:2.25},{id:'bounce',name:'上手反弹',windup:1.6,duration:2.25}] },
  { id:'yoru', name:'Yoru', zh:'夜露', short:'YO', color:'#7c9aea', skill:'Blindside / Fakeout', kind:'flash',
    description:'闪球必须接触表面才能激活，反弹后爆开。分身被射击才触发朝向攻击者的锥形闪光。',counter:'避开反弹后的蓝光；分身可不打，也可打掉后背闪。',
    variants:[{id:'bounce',name:'反弹闪球',windup:.6,duration:1.5},{id:'clone',name:'分身反闪',windup:.5,duration:2}] },
  { id:'vyse', name:'Vyse', zh:'维斯', short:'VY', color:'#c8b7e4', skill:'Arc Rose · 弧光玫瑰', kind:'flash',
    description:'预置于墙面的玫瑰，启动后短暂前摇再爆开。当前版本前摇期间也可被射击摧毁。',counter:'转身、躲掩体，或左键击碎玫瑰。',
    variants:[{id:'rose',name:'墙面玫瑰',windup:.5,duration:2}] },
  { id:'gekko', name:'Gekko', zh:'盖可', short:'GE', color:'#8bd8ca', skill:'Dizzy · 眩晕', kind:'plasma',
    description:'Dizzy 发现视线内目标后发射电浆，命中后遮挡视野。转头不能躲掉，必须打掉它、躲电浆或掩体。',counter:'左键击落 Dizzy，或移动躲开落点。',
    variants:[{id:'dizzy',name:'电浆锁定',windup:.65,duration:2}] },
  { id:'reyna', name:'Reyna', zh:'芮娜', short:'RE', color:'#c58bd6', skill:'Leer · 睥睨', kind:'nearsight',
    description:'视野中的魔眼持续造成近视。看开或遮挡可解除，也可以射击摧毁；不是一次性全屏闪光。',counter:'看开、躲墙或两枪击碎魔眼。',
    variants:[{id:'eye',name:'持续魔眼',windup:.4,duration:2}] },
  { id:'omen', name:'Omen', zh:'幽影', short:'OM', color:'#8f96c9', skill:'Paranoia · 暗魇', kind:'nearsight',
    description:'向前穿墙飞行的近视弹，命中判定与视角无关。横向走出弹道，背身无法避免。',counter:'横移出弹道。掩体不会挡住暗魇。',
    variants:[{id:'wave',name:'穿墙暗魇',windup:.65,duration:2}] },
  { id:'fade', name:'Fade', zh:'黑梦', short:'FA', color:'#98aab9', skill:'Prowler · 黯兽', kind:'nearsight',
    description:'追踪目标的黯兽，接触后近视，与朝向无关。这里练习射击或利用障碍拉开距离。',counter:'击毁黯兽或走位避开扑咬。',
    variants:[{id:'prowler',name:'追踪黯兽',windup:.4,duration:2.5}] },
  { id:'harbor', name:'Harbor', zh:'海神', short:'HA', color:'#70b9c1', skill:'Storm Surge / Reckoning', kind:'nearsight',
    description:'涡流在范围内造成近视和减速，现版本无需视线；大招水浪命中也不受背身影响。',counter:'离开地面范围或横移避开水浪。',
    variants:[{id:'surge',name:'涡流爆发',windup:.6,duration:2},{id:'wave',name:'清算水浪',windup:.7,duration:3}] },
];
// Techniques share the ability's mechanics, with different real launch geometry.
const technique=(id,name,base,extra={})=>({...base,id,name,mechanic:base.mechanic||base.id,...extra});
const a=id=>AGENTS.find(a=>a.id===id);
a('phoenix').variants.push(technique('high','高位曲闪',a('phoenix').variants[1],{height:3.2}),technique('reverse','反向出角闪',a('phoenix').variants[0]));
a('breach').variants.push(technique('high','墙面高闪',a('breach').variants[0],{height:3}),technique('low','贴地墙闪',a('breach').variants[0],{height:.5}),technique('offangle','侧墙错位闪',a('breach').variants[0]));
a('skye').variants[0].name='直飞蓄力鸟';a('skye').variants[2].route='sweep';
a('skye').variants.push(technique('curve','绕角转弯鸟',a('skye').variants[0],{route:'curve'}),technique('dive','高位下压鸟',a('skye').variants[0],{route:'dive'}),technique('sweep','横向回转鸟',a('skye').variants[0],{route:'sweep'}));
a('kayo').variants[1].name='近距离低抛';a('kayo').variants[2].name='真实墙面反弹';
a('kayo').variants.push(technique('sky','高空越掩体闪',a('kayo').variants[0],{pitch:22}),technique('ground','前压地弹闪',a('kayo').variants[0],{pitch:-12}),technique('cross','横向错位长抛',a('kayo').variants[0],{pitch:8}));
a('yoru').variants.push(technique('ground','近点地弹闪',a('yoru').variants[0]),technique('high','高位墙弹闪',a('yoru').variants[0]));
a('vyse').variants.push(technique('high','高位玫瑰',a('vyse').variants[0],{height:3}),technique('offangle','侧墙玫瑰',a('vyse').variants[0]),technique('delayed','预置延迟激活',a('vyse').variants[0]));
a('gekko').variants.push(technique('high','越掩体高抛',a('gekko').variants[0]),technique('bank','弹墙部署',a('gekko').variants[0]));
a('hush').variants.push(technique('late','延后转向出闪',a('hush').variants[0]),technique('high','高位转向下压',a('hush').variants[0]));
a('reyna').variants.push(technique('high','高位魔眼',a('reyna').variants[0]),technique('low','低位魔眼',a('reyna').variants[0]));
a('omen').variants.push(technique('cross','侧向穿墙暗魇',a('omen').variants[0]));
a('fade').variants.push(technique('cross','侧翼黯兽',a('fade').variants[0]));
a('harbor').variants.push(technique('surge-lead','前方落点涡流',a('harbor').variants[0]));
export const FLASH_AGENTS = AGENTS.filter(a => a.kind !== 'nearsight');
export const getAgent = id => AGENTS.find(a => a.id === id) || AGENTS[0];
export const DEFAULTS = { agent:'hush', variant:'redirect', mode:'stationary', arena:'corner', side:'random', sensitivity:.175, dpi:1600, calibration:1, interval:2.5, rounds:20, brightness:.75, volume:.35, random:false, mixVariants:false, coach:false, raw:true, custom:[], hushFuse:1.15, hushDuration:1.5, calibrations:{} };

// Evidence is attached to each field, not to the whole simulated ability.
const evidence=(status,note,patch)=>({status,note,url:patch?official(patch):null});
const pending=note=>evidence('estimate',note);
const confirmed=(note,patch)=>evidence('official',note,patch);
export function timingEvidence(agent,variant) {
  const entries={
    hush:[pending('当前使用可调训练值，尚无游戏内测量'),pending('当前使用可调训练值，尚无游戏内测量')],
    phoenix:[confirmed('从闪球出手至引爆','11-00'),confirmed('最大致盲时长','5-01')],
    breach:[confirmed('墙面显现后计时，不含穿墙部署行程','1-07'),confirmed('最大致盲时长','11-08')],
    skye:[confirmed('激活后的引爆前摇；飞行时间单列','3-06'),evidence(variant.id==='quick'?'derived':'official',variant.id==='quick'?'按飞行蓄力线性换算，插值形状仍需实测':'达到蓄力上限的最大致盲时长','5-07')],
    kayo:[pending('出手后的引信基线，等待独立实测；反弹规则有 10.06 公告依据'),confirmed('最大致盲时长',variant.id==='underhand'?'11-08':'5-07')],
    yoru:[variant.id==='clone'?pending('分身被打后至引爆的训练值'):confirmed('首次反弹后开始计时','2-06'),confirmed('最大致盲时长','11-08')],
    vyse:[pending('玫瑰激活后的前摇待实测'),confirmed('最大致盲时长','11-08')],
    gekko:[pending('部署形成时间待实测；另计 0.35 秒锁定和弹道时间'),pending('电浆遮挡总时长与渐隐分配待实测')],
    reyna:[confirmed('眼球到位后的生效前摇','5-07'),evidence('derived','公告为 2 秒存续；本实现按包含前摇解释，生效窗口 1.6 秒，取帧口径待实测','5-07')],
    omen:[pending('发射前摇待实测'),pending('近视持续时间待实测')],
    fade:[pending('追踪启动延迟待实测'),pending('近视持续时间待实测')],
    harbor:[(variant.mechanic||variant.id)==='surge'?confirmed('涡流爆炸前摇','12-00'):pending('水浪发射前摇待实测'),pending('近视持续时间待实测')],
  };
  const [windup,duration]=entries[agent.id];
  return {windup,duration};
}
