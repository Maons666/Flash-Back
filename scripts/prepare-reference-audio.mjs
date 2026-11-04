import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/assets/official/manifest.json','utf8'));
// Short excerpts of Riot's public demonstrations, NOT isolated game sound-bank files.
// These timestamps are reference editing decisions, not ability timing parameters.
const cuts={hush:{spawn:[2.05,.28],redirect:[3.55,.24],result:[6.9,.38]},phoenix:{spawn:[1.55,.2],result:[2.2,.28]},breach:{spawn:[3.5,.3],result:[4.1,.35]},skye:{spawn:[1.4,.25],activate:[3.45,.22],result:[3.7,.32]},kayo:{telegraph:[5.1,.22],result:[5.4,.32]},yoru:{bounce:[.8,.22],result:[1.35,.3]},vyse:{activate:[4.85,.3],result:[5.25,.38]},gekko:{spawn:[5.95,.22],lock:[7.4,.25]},reyna:{spawn:[1,.32]}};
const sounds={};const provenance=[];
for(const [id,events] of Object.entries(cuts)){
  const video=manifest.agents[id]?.abilities?.find(v=>v.key==='flash')?.video;if(!video)continue;
  const streams=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json','public/'+video.path],{encoding:'utf8'})).streams;
  if(!streams.some(s=>s.codec_type==='audio')){console.log(`${id}: official preview has no audio track`);continue;}sounds[id]={};
  for(const [event,[start,duration]] of Object.entries(events)){
    const path=`assets/official/${id}-${event}.ogg`;
    execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(start),'-i','public/'+video.path,'-t',String(duration),'-vn','-ac','1','-ar','48000','-af',`afade=t=in:d=0.006,afade=t=out:st=${duration-.035}:d=0.035`,'-c:a','libvorbis','-q:a','5','public/'+path]);
    sounds[id][event]=path;provenance.push({path,source:video.source,start,duration,kind:'official-demonstration-audio-excerpt',sha256:createHash('sha256').update(await readFile('public/'+path)).digest('hex')});
  }
}
await writeFile('src/official-sounds.js',`export const OFFICIAL_SOUNDS=${JSON.stringify(sounds,null,2)};\n`);
await writeFile('public/assets/official/audio-provenance.json',JSON.stringify({notes:'Edited from public Riot demonstration soundtracks; can include ambience. Not original isolated game audio. Some examples predate current balance changes.',clips:provenance},null,2));
console.log(`Prepared ${provenance.length} audio excerpts.`);
