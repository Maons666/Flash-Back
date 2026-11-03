import * as THREE from 'three';
import { verticalFov } from './math.js';

const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.82,...extra});
function mesh(geo,mat,parent,position=[0,0,0]){const m=new THREE.Mesh(geo,mat);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cuboid(parent,size,position,color){return mesh(new THREE.BoxGeometry(...size),typeof color==='string'?material(color):color,parent,position);}
function label(text,color='#dfe8e3',bg='#293e42',size=512) {
  const c=document.createElement('canvas');c.width=size;c.height=size/2;const x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=color;x.font=`700 ${size*.25}px Segoe UI`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,size/4);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:tex});
}
export class TrainingScene {
  constructor(container,trainer) {
    this.container=container;this.trainer=trainer;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.domElement.id='game-canvas';this.renderer.domElement.setAttribute('aria-label','第一人称 3D 背闪训练场');container.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#9eafb4');this.scene.fog=new THREE.Fog('#9eafb4',24,65);
    this.camera=new THREE.PerspectiveCamera(verticalFov(),16/9,.035,100);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#e2f0f7','#85806b',2.8));
    const sun=new THREE.DirectionalLight('#ffebcc',3);sun.position.set(-12,23,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:60});sun.shadow.normalBias=.025;this.scene.add(sun);
    this.mapGroup=new THREE.Group();this.scene.add(this.mapGroup);
    this.dynamic=new THREE.Group();this.scene.add(this.dynamic);this.weapon=new THREE.Group();this.camera.add(this.weapon);this.makeWeapon();
    this.marker=mesh(new THREE.TorusGeometry(.8,.035,6,48),new THREE.MeshBasicMaterial({color:'#87d4bf'}),this.scene);this.marker.rotation.x=-Math.PI/2;
    this.burst=mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false}),this.scene);this.burst.visible=false;
    this.rebuild();this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    const gl=this.renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  }
  clear(group) {
    group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.map?.dispose();m.dispose();}}});group.clear();
  }
  rebuild() {
    this.clear(this.mapGroup);
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#8e9691';ctx.fillRect(0,0,512,512);
    ctx.strokeStyle='#7d8680';ctx.lineWidth=3;ctx.strokeRect(0,0,512,512);ctx.lineWidth=1;ctx.strokeRect(7,7,498,498);
    for(let i=0;i<1000;i++){const n=(i*67)%512,m=(i*137)%512;ctx.fillStyle=i%2?'#939a94':'#8b938d';ctx.fillRect(n,m,2,2);}
    const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(14,14);tex.colorSpace=THREE.SRGBColorSpace;
    const floor=mesh(new THREE.PlaneGeometry(30,30),material('#ffffff',{map:tex}),this.mapGroup);floor.rotation.x=-Math.PI/2;
    for(const [i,b] of this.trainer.map.boxes.entries()) {
      const size=b.max.map((v,j)=>v-b.min[j]),pos=b.min.map((v,j)=>(v+b.max[j])/2),crate=b.style==='crate'||b.style==='custom';
      cuboid(this.mapGroup,size,pos,crate?'#506d6c':i<4?'#b2b7a9':'#cbc9b8');
      if(crate){
        for(const dy of [-size[1]/2+.12,size[1]/2-.12])cuboid(this.mapGroup,[size[0]+.025,.12,size[2]+.025],[pos[0],pos[1]+dy,pos[2]],'#324c4d');
        cuboid(this.mapGroup,[size[0]*.6,size[1]*.55,.025],[pos[0],pos[1],b.max[2]+.02],'#688481');
        const plate=mesh(new THREE.PlaneGeometry(.65,.32),label(String(i).padStart(2,'0'),'#d8dbb9','#425958'),this.mapGroup,[pos[0],pos[1],b.max[2]+.05]);
      } else {
        cuboid(this.mapGroup,[size[0]+.02,.14,size[2]+.02],[pos[0],.25,pos[2]],'#5b7474');
        cuboid(this.mapGroup,[size[0]+.04,.08,size[2]+.04],[pos[0],size[1]-.08,pos[2]],'#e6dfc5');
      }
    }
    // Far wall architecture and strong visual anchor for returning the crosshair.
    cuboid(this.mapGroup,[7,3,.12],[0,2,-13.94],'#354e54');
    mesh(new THREE.PlaneGeometry(3.5,1.75),label('SECTOR 01'),this.mapGroup,[0,2.5,-13.85]);
    cuboid(this.mapGroup,[5,.05,.1],[0,1.35,-13.8],'#dd8b70');
    for(const x of [-12,-9,9,12]){cuboid(this.mapGroup,[.25,6,.6],[x,3,-13.75],'#647471');cuboid(this.mapGroup,[.35,.08,5],[x,5.8,-11.5],'#586c6e');}
    for(const x of [-11,11]) {
      cuboid(this.mapGroup,[.08,.015,25],[x,.015,0],'#d9c68f');
      const m=mesh(new THREE.PlaneGeometry(1.6,.8),label('01','#b7c3b6','#6c807b'),this.mapGroup,[x,1.4,-13.85]);
    }
    for(let z=-10;z<=10;z+=2)cuboid(this.mapGroup,[.045,.015,.65],[0,.018,z],'#c6c5a8');
    const start=mesh(new THREE.RingGeometry(.85,.9,48),new THREE.MeshBasicMaterial({color:'#da9b79',side:THREE.DoubleSide}),this.mapGroup,[0,.025,9]);start.rotation.x=-Math.PI/2;
    // Low buildings outside the collision arena provide depth without clutter.
    for(let i=0;i<10;i++){const x=-25+i*5.5,h=6+(i*7%5);cuboid(this.mapGroup,[4,h,5],[x,h/2,-20-(i%3)*2],i%2?'#9ba7a3':'#adb2a7');}
    this.currentThreat=null;this.clear(this.dynamic);
  }
  makeWeapon() {
    const dark=material('#202e34',{metalness:.45,roughness:.45}),steel=material('#52616a',{metalness:.65,roughness:.4}),grip=material('#243336');
    this.weapon.position.set(.23,-.25,-.43);this.weapon.rotation.set(.02,-.025,-.025);
    cuboid(this.weapon,[.08,.1,.32],[0,0,0],dark);cuboid(this.weapon,[.065,.065,.34],[0,.014,-.27],steel);
    cuboid(this.weapon,[.034,.035,.15],[0,.02,-.51],dark);cuboid(this.weapon,[.05,.05,.04],[0,.055,-.32],dark);
    cuboid(this.weapon,[.025,.04,.03],[0,.07,-.08],steel);cuboid(this.weapon,[.075,.16,.06],[0,-.09,.04],grip).rotation.x=-.25;
    cuboid(this.weapon,[.07,.14,.08],[0,-.08,-.1],steel).rotation.x=.15;
    cuboid(this.weapon,[.09,.07,.22],[0,-.02,.24],dark);
    cuboid(this.weapon,[.016,.025,.13],[.045,.005,-.04],'#dc7e66');
    const hand=material('#a57e67');cuboid(this.weapon,[.12,.1,.12],[.015,-.16,.06],hand);
    cuboid(this.weapon,[.13,.11,.27],[.025,-.18,.21],'#425a5a');
    cuboid(this.weapon,[.105,.09,.13],[-.04,-.06,-.2],hand);
    cuboid(this.weapon,[.12,.11,.33],[-.09,-.14,-.04],'#425a5a').rotation.x=-.45;
  }
  createThreat(t) {
    this.clear(this.dynamic);const g=new THREE.Group();this.dynamic.add(g);this.object=g;
    const mat=material(t.agent.color,{emissive:t.agent.color,emissiveIntensity:.65,roughness:.3});
    const glow=new THREE.MeshBasicMaterial({color:t.agent.color,transparent:true,opacity:.55});
    const id=t.agent.id;
    if(id==='yoru'&&t.variant.id==='clone') {
      cuboid(g,[.45,.65,.25],[0,.1,0],mat);mesh(new THREE.SphereGeometry(.18,10,8),mat,g,[0,.62,0]);
      for(const s of [-1,1]){cuboid(g,[.14,.65,.16],[s*.15,-.55,0],mat);cuboid(g,[.12,.6,.14],[s*.32,.05,0],mat);}
    } else if(id==='skye') {
      mesh(new THREE.OctahedronGeometry(.22),mat,g);
      for(const s of [-1,1]){const wing=mesh(new THREE.ConeGeometry(.22,.8,3),mat,g,[s*.38,0,0]);wing.rotation.z=s*Math.PI/2;}
      mesh(new THREE.ConeGeometry(.13,.3,3),mat,g,[0,0,-.22]).rotation.x=-Math.PI/2;
    } else if(id==='vyse') {
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const p=mesh(new THREE.OctahedronGeometry(.19),mat,g,[Math.cos(a)*.24,Math.sin(a)*.24,0]);p.scale.set(.5,1.6,.6);p.rotation.z=a;}
      mesh(new THREE.SphereGeometry(.16,12,8),material('#fff5cc',{emissive:'#fff5cc'}),g);
    } else if(id==='gekko'||id==='reyna') {
      mesh(new THREE.SphereGeometry(id==='gekko'?.3:.32,16,12),mat,g);
      mesh(new THREE.SphereGeometry(.17,16,12),material('#ecf1d9'),g,[0,0,.23]);
      mesh(new THREE.SphereGeometry(.08,12,8),material('#21373e'),g,[0,0,.37]);
      if(id==='gekko')for(const s of [-1,1]){mesh(new THREE.SphereGeometry(.16,8,6),mat,g,[s*.34,.06,0]).scale.set(1.5,.4,1);}
    } else if(id==='fade') {
      mesh(new THREE.OctahedronGeometry(.45),mat,g).scale.set(1,.65,1.6);
      for(const s of [-1,1])mesh(new THREE.ConeGeometry(.12,.45,4),mat,g,[s*.25,.25,.1]);
    } else if(id==='harbor'&&t.variant.id==='surge') {
      const ring=mesh(new THREE.TorusGeometry(3.5,.045,6,80),glow,g);ring.rotation.x=Math.PI/2;
      const inner=mesh(new THREE.RingGeometry(.25,3.45,64),new THREE.MeshBasicMaterial({color:t.agent.color,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}),g);inner.rotation.x=-Math.PI/2;
    } else if(t.stage==='wave') {
      mesh(new THREE.SphereGeometry(id==='harbor'?2.5:1.45,20,12),new THREE.MeshBasicMaterial({color:t.agent.color,wireframe:true,transparent:true,opacity:.7}),g);
      mesh(new THREE.SphereGeometry(.3,16,12),mat,g);
    } else {
      const ball=mesh(id==='hush'?new THREE.IcosahedronGeometry(.18,0):id==='kayo'?new THREE.CylinderGeometry(.09,.09,.3,10):new THREE.SphereGeometry(.14,14,10),mat,g);
      mesh(new THREE.TorusGeometry(.24,.012,6,32),glow,g).rotation.x=.8;
      if(id==='breach')for(let i=0;i<4;i++){const sp=cuboid(g,[.07,.26,.04],[0,0,0],mat);sp.rotation.z=i*Math.PI/4;}
    }
    this.bolt=mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:'#8bffff'}),this.dynamic);this.bolt.visible=false;
    this.trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:t.agent.color,transparent:true,opacity:.35}));this.dynamic.add(this.trail);
    this.currentThreat=t;
  }
  onEvent(event) {
    if(event.type==='result'&&event.result.duration>0){this.burst.position.set(...event.threat.position);this.burst.material.color.set(event.threat.agent.color);this.burstAt=this.trainer.time;this.burst.visible=true;}
  }
  resize() {
    const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.fov=verticalFov(103,this.camera.aspect);this.camera.updateProjectionMatrix();
  }
  render() {
    const game=this.trainer,t=game.threat;this.camera.position.set(...game.player);this.camera.rotation.set(game.pitch,game.yaw,0,'YXZ');
    const recoil=Math.max(0,1-(game.time-game.lastShot)/.12);this.weapon.position.z=-.43+recoil*.04;
    this.marker.visible=Boolean(game.gate);if(game.gate)this.marker.position.set(game.gate[0],.035,game.gate[2]);
    const near=game.effect?.type==='near';this.scene.fog.color.set(near?'#1a2530':'#9eafb4');this.scene.fog.near=near?4.5:24;this.scene.fog.far=near?7:65;this.scene.background.copy(this.scene.fog.color);
    if(t&&t!==this.currentThreat)this.createThreat(t);
    if(this.object){
      this.dynamic.visible=Boolean(t&&!t.dead&&!t.resolved);
      if(t){this.object.position.set(...t.position);this.object.visible=t.visible;
        if(!['breach','vyse','yoru','harbor'].includes(t.agent.id)){this.object.rotation.y=game.time*1.8;this.object.rotation.z=Math.sin(game.time*5)*.08;}
        this.object.scale.setScalar(['triggered','activating'].includes(t.stage)?1+Math.sin(t.age*35)*.08:1);
        this.bolt.visible=Boolean(t.bolt);if(t.bolt)this.bolt.position.set(...t.bolt);
        this.trail.visible=t.visible&&['hush','skye','yoru'].includes(t.agent.id)&&t.trail.length>1;
        if(this.trail.visible){this.trail.geometry.dispose();this.trail.geometry=new THREE.BufferGeometry().setFromPoints(t.trail.map(p=>new THREE.Vector3(...p)));}
      }
    }
    if(this.burst.visible){const elapsed=game.time-this.burstAt;this.burst.visible=elapsed<.28;this.burst.scale.setScalar(1+elapsed*24);this.burst.material.opacity=Math.max(0,1-elapsed/.28);}
    this.renderer.render(this.scene,this.camera);
  }
}
