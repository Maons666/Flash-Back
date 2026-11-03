export function box(x,z,w,d,h=3.2,style='wall') {return {min:[x-w/2,0,z-d/2],max:[x+w/2,h,z+d/2],style};}
const boundary=()=>[box(-24.5,-10,1,54,7),box(24.5,-10,1,54,7),box(0,-36.5,48,1,7),box(0,16.5,48,1,7)];
export const MAPS = [
  {id:'open',name:'基础靶场',sub:'开阔视野 · 建立反应',index:'01',blocks:[]},
  {id:'corner',name:'L 型拐角',sub:'墙边出闪 · 小身位',index:'02',blocks:[box(-5,-1,6,1,3.5),box(-7.5,3,1,7,3.5),box(7,-5,5,1,3.5),box(9,0,1,9,3.5)]},
  {id:'boxes',name:'箱体掩护',sub:'移动切线 · 掩体规避',index:'03',blocks:[box(-3,0,2.6,2.6,2.7,'crate'),box(3,-4,2.6,2.6,2.7,'crate'),box(0,-9,4,2,3.2,'crate'),box(7,2,2,3,1.1,'crate')]},
  {id:'corridor',name:'交错长廊',sub:'行进过点 · 交叉威胁',index:'04',blocks:[box(-7,0,1,24,4),box(7,0,1,24,4),box(-4.5,2,4,1,3.2),box(4.5,-3,4,1,3.2),box(-4.5,-8,4,1,3.2)]},
];
export function makeMap(id,custom=[]) {
  const map=MAPS.find(m=>m.id===id)||MAPS[0];
  return {...map,spawn:[0,1.65,9],boxes:[...boundary(),...map.blocks,...custom.map(p=>box(p[0],p[1],2,2,2.8,'custom'))]};
}
