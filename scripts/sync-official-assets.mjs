import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'public/assets/official');
await mkdir(out,{recursive:true});
let previous={};try{previous=JSON.parse(await readFile(resolve(out,'manifest.json'),'utf8'));}catch{}
const ids={hush:['hush',/flashbulb/i],phoenix:['phoenix',/curveball/i],breach:['breach',/flashpoint/i],skye:['skye',/guiding light/i],kayo:['kay-o',/flash.?drive/i],yoru:['yoru',/blindside|fakeout/i],vyse:['vyse',/arc rose/i],gekko:['gekko',/dizzy/i],reyna:['reyna',/leer/i]};
function data(html){const m=html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(!m)throw Error('Official page data missing');return JSON.parse(m[1]);}
function collect(o,predicate,result=[]){if(!o||typeof o!=='object')return result;if(predicate(o))result.push(o);for(const v of Object.values(o))collect(v,predicate,result);return result;}
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r;}
async function download(url,name){
  if(new URL(url).hostname!=='cmsassets.rgpub.io')throw Error('Asset must come from the official Riot CDN');
  const path=resolve(out,name),cached=collect(previous,o=>o.path===`assets/official/${name}`&&o.source===url)[0];let bytes;
  if(cached)try{const existing=await readFile(path);if(createHash('sha256').update(existing).digest('hex')===cached.sha256)bytes=existing;}catch{}
  if(!bytes){bytes=Buffer.from(await(await get(url)).arrayBuffer());await writeFile(path,bytes);}
  return {path:`assets/official/${name}`,source:url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}
const list=data(await(await get('https://playvalorant.com/en-us/agents/')).text());
const cards=collect(list,o=>o.media?.url&&o.action?.payload?.url?.includes('/agents/'));
const manifest={owner:'Riot Games',retrieved:new Date().toISOString().slice(0,10),source:'https://playvalorant.com/en-us/agents/',notes:'Official published images and demonstration videos. Videos may show older balance values. No original 3D meshes or isolated sound banks are supplied by these pages.',agents:{}};
for(const [id,[slug,match]] of Object.entries(ids)){
  try{
    const page=`https://playvalorant.com/en-us/agents/${slug}/`,d=data(await(await get(page)).text());
    const card=cards.find(c=>c.action.payload.url.replace(/\/$/,'').endsWith('/'+slug));
    const agent={page,portrait:card?await download(card.media.url,`${id}-portrait.png`):null,abilities:[]};
    for(const group of collect(d,o=>o.content?.media?.sources&&match.test(o.content.title))){
      const key=/fakeout/i.test(group.content.title)?'clone':/reckoning/i.test(group.content.title)?'wave':'flash';
      agent.abilities.push({key,title:group.content.title,description:group.content.description?.body??'',icon:await download(group.thumbnail.url,`${id}-${key}.png`),video:await download(group.content.media.sources[0].src,`${id}-${key}.mp4`)});
    }
    manifest.agents[id]=agent;console.log(`${id}: portrait=${!!agent.portrait}, abilities=${agent.abilities.length}`);
  }catch(error){manifest.agents[id]={unavailable:true,error:error.message};console.error(`${id}: ${error.message}`);}
}
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(resolve(root,'src/official-assets.js'),`// Published by Riot Games. Exact URLs and hashes: public/assets/official/manifest.json.\nexport const OFFICIAL_ASSETS = ${JSON.stringify(Object.fromEntries(Object.entries(manifest.agents).map(([id,a])=>[id,{portrait:a.portrait?.path,abilities:a.abilities?.map(v=>({key:v.key,title:v.title,icon:v.icon.path,video:v.video.path})),page:a.page}])),null,2)};\n`);
