import * as THREE from 'three';
import {sampleRoute} from './trajectories.js';
const mat=(color,emissive=color,intensity=.2)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:.4,metalness:.2});
function part(parent,geometry,material,position=[0,0,0],size){const m=new THREE.Mesh(geometry,material);m.position.set(...position);if(size)m.scale.set(...size);parent.add(m);return m;}
const sphere=(p,m,pos,size)=>part(p,new THREE.SphereGeometry(1,20,14),m,pos,size);
const box=(p,m,pos,size)=>part(p,new THREE.BoxGeometry(...size),m,pos);
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffffffff');g.addColorStop(.12,'#ffffffcc');g.addColorStop(.35,'#ffffff55');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function aura(p,color,size,opacity=.6){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.set(size,size,1);p.add(s);return s;}
function leaf(p,material,length,width,position=[0,0,0],angle=0){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-width*.7,length*.25,-width*.5,length*.7,0,length);shape.bezierCurveTo(width*.6,length*.7,width*.7,length*.3,0,0);
  const m=part(p,new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelThickness:.008,bevelSize:.012,bevelSegments:1,steps:1,curveSegments:8}),material,position);m.rotation.z=angle;return m;
}
function ring(p,color,radius,thickness=.012){return part(p,new THREE.TorusGeometry(radius,thickness,6,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));}
export function makeAbilityVisual(t){
  const root=new THREE.Group(),id=t.agent.id;
  const green=mat('#53734a','#65d94c',.17),gold=mat('#a89c59','#c3d88c',.12),dark=mat('#29353d','#000000',0);
  let wings=[],core,halo,animated=[];
  if(id==='skye'){
    sphere(root,green,[0,0,.02],[.14,.15,.33]);sphere(root,gold,[0,.06,-.24],[.13,.13,.16]);
    const beak=part(root,new THREE.ConeGeometry(.06,.14,5),gold,[0,.015,-.41]);beak.rotation.x=-Math.PI/2;
    for(const side of [-1,1]){
      sphere(root,mat('#efffb8','#f6ffb2',2),[side*.105,.085,-.3],[.025,.025,.02]);
      const wing=new THREE.Group();wing.position.set(side*.1,.06,.02);root.add(wing);wings.push({wing,side});
      const shoulder=leaf(wing,green,.48,.2,[0,0,0],-side*1.15);shoulder.rotation.x=Math.PI/2;
      for(let i=0;i<7;i++){
        const length=.48-i*.027,feather=leaf(wing,i%3===0?gold:green,length,.085,[side*(.16+i*.055),-.01,.02+i*.04],-side*(1.06+i*.075));feather.rotation.x=Math.PI/2;
        part(feather,new THREE.CylinderGeometry(.002,.003,length*.72,4),gold,[0,length*.42,.036]);
      }
    }
    for(let i=0;i<6;i++){const scale=leaf(root,i%2?green:gold,.15,.055,[(i%2?1:-1)*.06,.13,-.15+Math.floor(i/2)*.13],0);scale.rotation.x=Math.PI/2;}
    for(let i=-2;i<=2;i++){const f=leaf(root,i%2?green:gold,.42,.055,[i*.04,0,.25],i*.13);f.rotation.x=Math.PI/2;}
    halo=aura(root,'#8cff57',1.1,.24);core=aura(root,'#d4ffaf',.2,.4);
  }else if(id==='kayo'){
    const shell=mat('#364149','#000000',0),metal=mat('#8f9fa0','#364754',.1),light=mat('#c9eddd','#baffd7',1.8);
    part(root,new THREE.CylinderGeometry(.085,.085,.25,12),shell);
    for(const y of [-.13,.13])part(root,new THREE.CylinderGeometry(.105,.105,.045,8),metal,[0,y,0]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;box(root,light,[Math.cos(a)*.086,0,Math.sin(a)*.086],[.025,.14,.025]);}
    core=light;halo=aura(root,'#ff5c60',.95,.12);
  }else if(id==='gekko'){
    const blue=mat('#249ada','#18a7e8',.35),purple=mat('#554895','#423d97',.22),lime=mat('#f9dd64','#fff189',.7),face=mat('#45d4dd','#43deed',.4);
    sphere(root,purple,[0,0,.02],[.35,.33,.29]);sphere(root,blue,[0,.04,-.03],[.31,.29,.27]);sphere(root,face,[0,-.01,-.23],[.25,.24,.08]);
    for(const s of [-1,1]){
      sphere(root,lime,[s*.12,.025,-.3],[.057,.085,.025]);sphere(root,mat('#b95757','#c84949',.3),[s*.12,.025,-.323],[.025,.045,.012]);
      const fin=leaf(root,blue,.28,.07,[s*.25,.08,.02],-s*1.1);fin.rotation.x=.7;
      part(root,new THREE.ConeGeometry(.065,.2,5),purple,[s*.19,.34,.02]);
    }
    for(let i=-1;i<=1;i++)sphere(root,blue,[i*.07,-.28,.03],[.04,.14,.04]);halo=aura(root,'#35cfff',1.05,.22);
  }else if(id==='vyse'){
    const steel=mat('#6e647d','#b87cd2',.3),bright=mat('#d8aaf0','#e995ff',1);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;const p=leaf(root,i%2?bright:steel,.36,.095,[Math.sin(a)*.04,Math.cos(a)*.04,0],-a);p.rotation.x=i%2?.35:-.35;}
    core=sphere(root,bright,[0,0,.04],[.09,.09,.08]);halo=aura(root,'#ed8dff',1.1,.35);
  }else if(id==='breach'){
    const orange=mat('#d57f29','#ff9b35',2);
    for(let i=0;i<3;i++)animated.push(ring(root,'#ffb04b',.14+i*.105,.015));
    for(let i=0;i<6;i++){const a=i*Math.PI/3,m=box(root,orange,[Math.sin(a)*.27,Math.cos(a)*.27,0],[.045,.15,.035]);m.rotation.z=-a;}
    core=aura(root,'#fff0b6',.28,1);halo=aura(root,'#ff7c25',1.3,.55);
  }else if(id==='yoru'&&t.mechanic==='clone'){
    const coat=mat('#27417d','#347bc0',.35),skin=mat('#c3a9a2','#4b7dd1',.3);
    box(root,coat,[0,.1,0],[.42,.6,.25]);sphere(root,skin,[0,.59,0],[.16,.21,.15]);
    for(const s of [-1,1]){const leg=box(root,coat,[s*.12,-.5,0],[.14,.65,.17]);animated.push(leg);box(root,coat,[s*.32,.1,0],[.14,.58,.16]);}
    for(let i=-2;i<=2;i++)part(root,new THREE.ConeGeometry(.07,.25,4),coat,[i*.055,.81,.01]);halo=aura(root,'#3c8eff',1.7,.18);
  }else if(id==='reyna'){
    const violet=mat('#55205c','#c244ed',.9);sphere(root,violet,[0,0,0],[.32,.37,.16]);
    sphere(root,mat('#f3a3e8','#f473e4',1.3),[0,0,-.15],[.17,.2,.035]);sphere(root,dark,[0,0,-.19],[.035,.15,.02]);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;const f=leaf(root,violet,.4,.03,[Math.sin(a)*.21,Math.cos(a)*.21,.01],-a);animated.push(f);}
    halo=aura(root,'#c439e5',1.6,.6);
  }else if(id==='hush'){
    const frame=mat('#27252d','#6d2359',.12),edge=mat('#827181','#b368a3',.28),bulb=mat('#bd34bd','#ff56e5',2);
    part(root,new THREE.OctahedronGeometry(.13,1),bulb,[0,0,0],[.75,1.5,.75]);
    for(const y of [-.19,.19]){const cap=part(root,new THREE.CylinderGeometry(.11,.1,.045,8),edge,[0,y,0]);cap.rotation.z=y<0?.08:-.08;}
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.19,0),new THREE.Vector3(Math.cos(a)*.15,-.1,Math.sin(a)*.15),new THREE.Vector3(Math.cos(a)*.15,.1,Math.sin(a)*.15),new THREE.Vector3(0,.19,0)]);
      part(root,new THREE.TubeGeometry(curve,14,.018,5,false),frame);
    }
    halo=aura(root,'#e643cd',.85,.65);core=aura(root,'#ff94f4',.22,.85);
  }else if(id==='phoenix'){
    const fire=mat('#ffa12f','#ff641c',2.4);part(root,new THREE.TorusGeometry(.13,.025,8,40),fire);
    const hot=ring(root,'#ffed9d',.14,.009);hot.rotation.y=.3;animated.push(hot);
    for(let i=0;i<9;i++){const a=i*2.39996;const spark=part(root,new THREE.ConeGeometry(.009,.07,4),fire,[Math.cos(a)*.22,Math.sin(a)*.22,Math.sin(i)*.04]);spark.rotation.z=a-Math.PI/2;animated.push(spark);}
    halo=aura(root,'#ff621d',.65,.55);
  }else{
    const color='#488aff';
    const body=mat(color,color,1.2);sphere(root,body,[0,0,0],[.12,.12,.12]);halo=aura(root,color,.85,.8);core=aura(root,'#fff7dc',.28,.8);
    for(let i=0;i<3;i++){const r=ring(root,color,.16+i*.025,.016);r.rotation.set(i,0,i*.8);animated.push(r);}
  }
  for(const object of animated)object.userData.baseZ=object.rotation.z;
  return {root,update(threat){
    const age=threat.age,remaining=threat.fuse-age;
    if(id==='skye'){
      const direction=new THREE.Vector3(...(threat.direction||[0,0,-1])).normalize();
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
      const ahead=new THREE.Vector3(...sampleRoute(threat.route,Math.min(age,threat.activateAt)*threat.motion.speed+.4).direction);
      const turn=new THREE.Vector3().crossVectors(direction,ahead).y;root.rotateZ(THREE.MathUtils.clamp(-turn*6,-.55,.55));
      const flap=Math.sin(age*28)*.38;for(const {wing,side} of wings)wing.rotation.z=side*(flap+.08);
      const active=threat.stage==='activating',charge=threat.charged;
      halo.material.color.set(active?'#fff1a5':charge?'#ffc75a':'#82ef58');halo.material.opacity=active?.9:charge?.6:.35;halo.scale.setScalar(active?1.5+Math.sin(age*60)*.2:1.4);
      if(active)for(const {wing,side} of wings)wing.rotation.z=side*.9;
    }else if(id==='kayo'){
      root.rotation.set(age*8,age*4,age*3);
      const armed=threat.telegraph||threat.bounceArmed;halo.material.opacity=armed?.55+Math.sin(age*45)*.16:.08;
      halo.scale.setScalar(threat.telegraph?1.1:threat.bounceArmed?.7:.4);core.emissive.set(armed?'#ff6960':'#8dc8bb');core.emissiveIntensity=armed?2:.5;
    }else if(['vyse','breach'].includes(id)){
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...(threat.normal||[0,0,1])));
      const dormant=threat.stage==='dormant';halo.material.opacity=dormant?.12:.5+Math.sin(age*32)*.2;
      root.scale.setScalar(dormant?.75:1+Math.max(0,.4-remaining)*.6);
    }else if(id==='gekko'){
      root.lookAt(new THREE.Vector3(...threat.initialPlayer));root.rotateY(Math.PI);
      if(id==='gekko')root.position.y+=Math.sin(age*7)*.035;
    }else if(id==='hush'){root.rotation.set(Math.sin(age*5)*.4,age*3,Math.sin(age*4)*.25);halo.material.opacity=.48+Math.sin(age*34)*.12;}
    else{root.rotation.y=age*1.3;for(let i=0;i<animated.length;i++)animated[i].rotation.z=animated[i].userData.baseZ+age*.8*(i%2?1:-1);}
    if(id==='yoru'&&threat.mechanic==='clone')for(let i=0;i<animated.length;i++)animated[i].rotation.x=Math.sin(age*9+i*Math.PI)*.45;
  }};
}

export class FlightTrail {
  constructor(parent){
    this.geometry=new THREE.BufferGeometry();this.positions=new Float32Array(80*2*3);this.alpha=new Float32Array(80*2);const indices=[];
    for(let i=0;i<79;i++)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('fade',new THREE.BufferAttribute(this.alpha,1).setUsage(THREE.DynamicDrawUsage));this.geometry.setIndex(indices);
    this.material=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color('#ffffff')}},vertexShader:'attribute float fade; varying float a; void main(){a=fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 tint;varying float a;void main(){gl_FragColor=vec4(tint,a);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;parent.add(this.mesh);
  }
  update(t,camera){
    const path=t.trail||[],id=t.agent.id;this.mesh.visible=t.visible&&path.length>1&&!['breach','vyse','reyna'].includes(id);if(!this.mesh.visible)return;
    this.material.uniforms.tint.value.set(id==='skye'?(t.charged?'#ffd57b':'#88fcb8'):id==='kayo'?(t.telegraph?'#ff8672':'#c1d9d7'):t.agent.color);
    const width=id==='skye'?.045:id==='kayo'?.013:.027;
    for(let i=0;i<path.length;i++){
      const p=new THREE.Vector3(...path[i].position),next=new THREE.Vector3(...path[Math.min(path.length-1,i+1)].position),prev=new THREE.Vector3(...path[Math.max(0,i-1)].position);
      const side=new THREE.Vector3().crossVectors(next.sub(prev),camera.position.clone().sub(p)).normalize().multiplyScalar(width);
      const fade=Math.max(0,1-(t.age-path[i].at)/.28)**2*(id==='kayo'&&!t.telegraph?.18:.65);
      for(let n=0;n<2;n++){const v=p.clone().addScaledVector(side,n?1:-1);v.toArray(this.positions,(i*2+n)*3);this.alpha[i*2+n]=fade;}
    }
    this.geometry.setDrawRange(0,(path.length-1)*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.fade.needsUpdate=true;
  }
}
