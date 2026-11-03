import * as THREE from 'three';
const palettes={phoenix:['#bd6d64','#fff6b0'],breach:['#c48470','#fff7be'],skye:['#517667','#fff9a0'],kayo:['#315e61','#ffffb4'],yoru:['#364685','#bdfaff'],vyse:['#454781','#ffd5fa'],hush:['#7c206e','#ffb8eb']};
export class ExposureVisual {
  constructor(container){this.canvas=document.createElement('canvas');this.canvas.className='exposure-canvas';this.canvas.hidden=true;container.append(this.canvas);this.context=this.canvas.getContext('2d');this.after=document.createElement('canvas');this.center=[.5,.5];}
  capture(renderer,camera,position){
    const source=renderer.domElement;this.after.width=source.width;this.after.height=source.height;this.after.getContext('2d').drawImage(source,0,0);
    const point=new THREE.Vector3(...position).project(camera);this.center=[Math.max(.05,Math.min(.95,(point.x+1)/2)),Math.max(.05,Math.min(.95,(1-point.y)/2))];
  }
  render(effect,time,brightness=.75,enabled=true){
    const c=this.canvas,x=this.context;c.hidden=!enabled||!effect||!['flash','plasma'].includes(effect.type)||time>=effect.until;if(c.hidden)return;
    const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    x.clearRect(0,0,w,h);const elapsed=Math.max(0,time-effect.at),remaining=effect.until-time,fade=Math.min(1,remaining/Math.min(effect.duration*.4,.65));
    if(effect.type==='plasma'){
      const spread=Math.min(1,.55+elapsed*8),cx=w*.5,cy=h*.5,r=Math.min(w*.42,h*.66)*spread;
      x.globalAlpha=fade;
      for(let i=0;i<12;i++){
        const a=i*2.39996,d=r*(.18+(i%4)*.19),size=r*(.21+(i%3)*.07);
        const px=cx+Math.cos(a)*d*1.3,py=cy+Math.sin(a)*d+Math.min(elapsed,.5)*(i%3)*12;
        const g=x.createRadialGradient(px-size*.2,py-size*.2,0,px,py,size);g.addColorStop(0,'#d9ed7a');g.addColorStop(.6,'#acd54b');g.addColorStop(.9,'#519d87');g.addColorStop(1,'#519d8700');x.fillStyle=g;x.beginPath();x.ellipse(px,py,size*1.15,size,Math.sin(i),0,Math.PI*2);x.fill();
      }
      const g=x.createRadialGradient(cx,cy,0,cx,cy,r*.78);g.addColorStop(0,'#d2e87d');g.addColorStop(.75,'#c1df6f');g.addColorStop(1,'#87c37100');x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);x.globalAlpha=1;return;
    }
    const [shade,light]=palettes[effect.agent]||palettes.phoenix,cx=this.center[0]*w,cy=this.center[1]*h;
    x.globalAlpha=fade*brightness;
    x.fillStyle=shade;x.fillRect(0,0,w,h);
    const radius=Math.hypot(w,h)*(1-Math.min(.55,elapsed/Math.max(.1,effect.duration)*.55));
    const haze=x.createRadialGradient(cx,cy,0,cx,cy,radius);haze.addColorStop(0,light);haze.addColorStop(.08,light+'dd');haze.addColorStop(.35,shade+'88');haze.addColorStop(1,shade+'00');x.fillStyle=haze;x.fillRect(0,0,w,h);
    x.save();x.translate(cx,cy);x.globalCompositeOperation='screen';
    for(let i=0;i<32;i++){
      const angle=i*2.39996,ray=radius*(.35+((i*17)%13)/20),width=.004+((i*7)%9)*.0014;
      const g=x.createLinearGradient(0,0,Math.cos(angle)*ray,Math.sin(angle)*ray);g.addColorStop(0,light);g.addColorStop(.15,light+'b0');g.addColorStop(1,light+'00');x.fillStyle=g;
      x.beginPath();x.moveTo(0,0);x.lineTo(Math.cos(angle-width)*ray,Math.sin(angle-width)*ray);x.lineTo(Math.cos(angle+width)*ray,Math.sin(angle+width)*ray);x.closePath();x.fill();
    }
    x.restore();x.globalCompositeOperation='source-over';
    if(fade<1&&this.after.width){x.globalAlpha=(1-fade)*fade*.22;x.filter='blur(3px) saturate(0)';x.drawImage(this.after,0,0,w,h);x.filter='none';}
    x.globalAlpha=Math.max(0,1-elapsed/.065)*brightness;x.fillStyle='#fffbe9';x.fillRect(0,0,w,h);x.globalAlpha=1;
  }
  dispose(){this.canvas.remove();}
}
