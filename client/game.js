import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86b8d8);
scene.fog = new THREE.FogExp2(0x86b8d8, 0.00165);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 1600);
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const ray = new THREE.Raycaster();
const loader = new GLTFLoader();

// ---------- PROCEDURAL MATERIALS ----------
function texturePattern(base, speck, count=1800, size=256){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0,0,size,size);
  for(let i=0;i<count;i++){
    x.fillStyle = speck;
    const s = Math.random()*3+1;
    x.globalAlpha = Math.random()*.18+.04;
    x.fillRect(Math.random()*size,Math.random()*size,s,s);
  }
  x.globalAlpha=1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
const grassTex = texturePattern('#3b6f3b','#173817'); grassTex.repeat.set(35,35);
const asphaltTex = texturePattern('#24272b','#777b80'); asphaltTex.repeat.set(18,18);
const concreteTex = texturePattern('#777b7f','#d0d0d0'); concreteTex.repeat.set(3,3);
const dirtTex = texturePattern('#6c5236','#2e2115'); dirtTex.repeat.set(10,10);

function pbr(color, rough=.75, metal=0, map=null){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,map});
}
const grassMat = pbr(0xffffff,.98,0,grassTex);
const asphaltMat = pbr(0x55585c,.9,.05,asphaltTex);
const concreteMat = pbr(0x9a9da0,.82,0,concreteTex);
const dirtMat = pbr(0xffffff,1,0,dirtTex);

// ---------- WORLD LIGHTING ----------
const hemi = new THREE.HemisphereLight(0xd8efff,0x26321f,2.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d2,4.2);
sun.position.set(-180,260,120); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-320; sun.shadow.camera.right=320;
sun.shadow.camera.top=320; sun.shadow.camera.bottom=-320;
sun.shadow.camera.near=1; sun.shadow.camera.far=800;
sun.shadow.bias=-0.00025;
scene.add(sun);

// Soft atmospheric sky dome.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900,32,16),
  new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x397bb1)},bottom:{value:new THREE.Color(0xdceef4)}},vertexShader:'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float h=pow(max(v.y,0.0),0.55);gl_FragColor=vec4(mix(bottom,top,h),1.0);}'})
);
scene.add(sky);

// ---------- GROUND ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),grassMat);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

// Roads, sidewalks and lanes.
function road(x,z,w,d,rot=0){
  const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),asphaltMat); r.rotation.x=-Math.PI/2; r.rotation.z=rot; r.position.set(x,.012,z); r.receiveShadow=true; scene.add(r);
  const sidewalk=new THREE.Mesh(new THREE.PlaneGeometry(w+5,d+5),concreteMat); sidewalk.rotation.x=-Math.PI/2; sidewalk.rotation.z=rot; sidewalk.position.set(x,.006,z); scene.add(sidewalk);
  const laneMat=new THREE.MeshBasicMaterial({color:0xd6b84c});
  for(let i=-Math.floor(w/20);i<=Math.floor(w/20);i++){
    const lane=new THREE.Mesh(new THREE.PlaneGeometry(.16,5),laneMat); lane.rotation.x=-Math.PI/2; lane.rotation.z=rot; lane.position.set(x+i*12,.02,z); scene.add(lane);
  }
}
road(0,0,900,28,0); road(0,0,28,900,Math.PI/2); road(0,-180,900,24,0); road(180,0,24,900,Math.PI/2);

// Water and shoreline.
const water = new THREE.Mesh(new THREE.PlaneGeometry(900,420),new THREE.MeshPhysicalMaterial({color:0x2e86a8,roughness:.18,metalness:.05,transmission:.05,transparent:true,opacity:.88}));
water.rotation.x=-Math.PI/2; water.position.set(0,-.04,-480); scene.add(water);

// ---------- CITY ----------
function building(x,z,w,d,h){
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.57,.08,.32+Math.random()*.18),roughness:.7,metalness:.08}));
  b.position.set(x,h/2,z); b.castShadow=true; b.receiveShadow=true; scene.add(b);
  const floors=Math.max(2,Math.floor(h/4));
  const windowMat=new THREE.MeshPhysicalMaterial({color:0x8eb8c8,roughness:.16,metalness:.35,emissive:0x102028,emissiveIntensity:.25});
  for(let f=1;f<floors;f++){
    for(let side=-1;side<=1;side+=2){
      for(let q=-1;q<=1;q++){
        const win=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.7,w*.13),1.1),windowMat);
        win.position.set(x+q*w*.28,z+side*(d/2+.012),f*3.2+.8); win.rotation.x=Math.PI/2; win.rotation.z=Math.PI/2; scene.add(win);
      }
    }
  }
}
const city=[[-120,-120,52,38,32],[0,-150,62,42,55],[130,-100,58,48,42],[-160,120,58,44,48],[40,130,50,62,68],[170,150,72,48,54],[-250,-60,48,48,35],[260,-170,55,42,62],[-280,190,60,52,46],[285,120,48,58,72],[0,260,75,45,52]];
city.forEach(v=>building(...v));

// Smaller houses/shops fill the city blocks.
for(let i=0;i<36;i++){
  const x=(Math.random()-.5)*620,z=(Math.random()-.5)*620;
  if(Math.abs(x)<45||Math.abs(z)<45) continue;
  building(x,z,18+Math.random()*18,16+Math.random()*18,6+Math.random()*12);
}

// Trees with trunks, foliage and shadows.
for(let i=0;i<150;i++){
  const a=Math.random()*Math.PI*2,r=70+Math.random()*560;
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,2.2,8),pbr(0x5a3824,.95)); trunk.position.y=1.1; trunk.castShadow=true; g.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.2+Math.random()*1.4,1),pbr(0x245a2d,.95)); crown.position.y=3.5; crown.castShadow=true; g.add(crown);
  g.position.set(Math.cos(a)*r,0,Math.sin(a)*r); scene.add(g);
}

// Parked cars: simple reflective silhouettes for visual depth.
function car(x,z,color,rot){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,.55,4.4),new THREE.MeshPhysicalMaterial({color,roughness:.24,metalness:.62,clearcoat:.7,clearcoatRoughness:.12})); body.position.y=.62; body.castShadow=true; g.add(body);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.75,.62,2.05),new THREE.MeshPhysicalMaterial({color:0x17242b,roughness:.12,metalness:.2,transmission:.08,transparent:true,opacity:.9})); cabin.position.set(0,1.05,-.15); cabin.castShadow=true; g.add(cabin);
  for(const sx of [-1.05,1.05]) for(const sz of [-1.45,1.45]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.22,16),pbr(0x151515,.95,.05)); wheel.rotation.z=Math.PI/2; wheel.position.set(sx,.38,sz); g.add(wheel)}
  g.position.set(x,0,z); g.rotation.y=rot; scene.add(g);
}
for(let i=0;i<26;i++) car((Math.random()-.5)*520,(Math.random()-.5)*520,[0x202a35,0x7b1d1d,0xc2c7c9,0x172f53,0x5f6530][i%5],Math.random()*Math.PI*2);

// ---------- PLAYER ----------
const player=new THREE.Group(); player.position.set(0,0,40); scene.add(player);
const fallback=new THREE.Group();
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,.9,6,12),pbr(0x245bc4,.68)); body.position.y=1; body.castShadow=true; fallback.add(body);
const head=new THREE.Mesh(new THREE.SphereGeometry(.32,20,16),pbr(0xd29a73,.75)); head.position.y=1.9; head.castShadow=true; fallback.add(head);
player.add(fallback);
let character=null,mixer=null,idleAction=null,walkAction=null,runAction=null,currentAction=null;
function playAction(a){if(!a||currentAction===a)return;if(currentAction){currentAction.fadeOut(.2)}a.reset().fadeIn(.2).play();currentAction=a}
loader.load('https://threejs.org/examples/models/gltf/Soldier.glb',g=>{
  character=g.scene; character.scale.setScalar(1.02); character.position.y=0; character.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material&&o.material.isMeshStandardMaterial)o.material.roughness=.62}}); player.add(character); fallback.visible=false;
  mixer=new THREE.AnimationMixer(character); const clips=g.animations;
  const find=n=>clips.find(c=>c.name.toLowerCase().includes(n.toLowerCase()));
  idleAction=mixer.clipAction(find('idle')||clips[0]); walkAction=mixer.clipAction(find('walk')||clips[3]||clips[0]); runAction=mixer.clipAction(find('run')||clips[1]||clips[0]); playAction(idleAction);
},undefined,()=>{console.warn('Character model unavailable; using fallback model')});

// Weapon with metallic parts and muzzle.
const weapon=new THREE.Group();
const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.2,.22,1.25),new THREE.MeshPhysicalMaterial({color:0x20252a,roughness:.28,metalness:.82,clearcoat:.35})); gunBody.position.set(.42,1.42,-.6); gunBody.castShadow=true; weapon.add(gunBody);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.75,16),new THREE.MeshPhysicalMaterial({color:0x111316,roughness:.2,metalness:.9})); barrel.rotation.x=Math.PI/2; barrel.position.set(.42,1.42,-1.58); weapon.add(barrel); player.add(weapon);

// ---------- TARGETS / LOOT ----------
const targets=[]; function spawnTarget(){const t=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,2.2,24),new THREE.MeshStandardMaterial({color:0xd62f32,roughness:.5,metalness:.08})); t.position.set((Math.random()-.5)*180,1.1,(Math.random()-.5)*180); t.userData.hp=100; t.castShadow=true; scene.add(t); targets.push(t)} for(let i=0;i<12;i++)spawnTarget();
const loots=[]; const lootMat=new THREE.MeshPhysicalMaterial({color:0xf4c542,emissive:0x5a3d00,emissiveIntensity:.55,roughness:.25,metalness:.45,clearcoat:.8});
function loot(type){const o=new THREE.Mesh(new THREE.BoxGeometry(.55,.35,.55),lootMat);o.position.set((Math.random()-.5)*360,.35,(Math.random()-.5)*360);o.userData.loot=type;o.userData.weight=type==='armor'?18:type==='medkit'?8:4;o.castShadow=true;scene.add(o);loots.push(o)} for(let i=0;i<24;i++)loot(['medkit','armor','arAmmo','grenades'][Math.floor(Math.random()*4)]);

// ---------- GAME STATE ----------
const weapons=[{name:'AR',mag:30,reserve:120,damage:25,rate:100},{name:'SMG',mag:40,reserve:160,damage:18,rate:75},{name:'SHOTGUN',mag:8,reserve:48,damage:60,rate:650}];
let wi=0,ammo=30,reserve=120,hp=100,kills=0,lastShot=0,shooting=false,ads=false,pitch=-.1,stance='stand',jumpQueued=false,mx=0,my=0,sprinting=false;
const keys={}; const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const inv={medkit:1,armor:0,grenades:1,arAmmo:90,weight:18,capacity:100};
function msg(s){$('message').textContent=s;$('message').style.display='block';clearTimeout(msg.t);msg.t=setTimeout(()=>$('message').style.display='none',900)}
function hud(){$('stats').textContent=`HP ${Math.round(hp)} · ${weapons[wi].name} ${ammo}/${reserve} · Kills ${kills}`}
function reload(){const m=weapons[wi].mag,n=Math.min(m-ammo,reserve);ammo+=n;reserve-=n;hud();msg(n?'RELOADED':'NO AMMO')}
function shoot(){const w=weapons[wi],now=performance.now();if(now-lastShot<w.rate)return;if(ammo<=0){reload();return}lastShot=now;ammo--;ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(targets,false);if(hits.length){const t=hits[0].object;t.userData.hp-=w.damage;if(t.userData.hp<=0){scene.remove(t);targets.splice(targets.indexOf(t),1);kills++;msg('ELIMINATION +1');setTimeout(spawnTarget,900)}else msg('HIT')}hud()}
function pickup(){let best=null,dist=7;for(const o of loots){const d=o.position.distanceTo(player.position);if(d<dist){best=o;dist=d}}if(!best){msg('NO LOOT NEARBY');return}if(inv.weight+best.userData.weight>inv.capacity){msg('BACKPACK FULL');return}inv[best.userData.loot]=(inv[best.userData.loot]||0)+1;inv.weight+=best.userData.weight;scene.remove(best);loots.splice(loots.indexOf(best),1);msg('LOOT PICKED UP');renderBag()}
function renderBag(){$('invBody').innerHTML=[['medkit','Med Kit'],['armor','Armor'],['grenades','Grenades'],['arAmmo','AR Ammo']].map(([k,n])=>`<div class="item"><span>${n}: ${inv[k]||0}</span><button data-use="${k}">USE</button></div>`).join('')+`<div class="item"><span>Weapon: ${weapons[wi].name}</span><button id="switchGun">SWITCH</button></div>`;$('weight').textContent=`Weight ${inv.weight} / ${inv.capacity}`;$('invBody').querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>use(b.dataset.use));$('switchGun').onclick=()=>{wi=(wi+1)%weapons.length;ammo=weapons[wi].mag;reserve=weapons[wi].reserve;hud();renderBag()}}
function use(k){if(!inv[k])return;if(k==='medkit'){hp=Math.min(100,hp+60);inv[k]--;inv.weight=Math.max(0,inv.weight-8)}else if(k==='armor'){hp=Math.min(100,hp+25);inv[k]--;inv.weight=Math.max(0,inv.weight-18)}else if(k==='arAmmo'){reserve+=inv[k]*30;inv.weight=Math.max(0,inv.weight-inv[k]*4);inv[k]=0}else{inv[k]--;inv.weight=Math.max(0,inv.weight-4)}hud();renderBag()}
function toggleBag(){const x=$('inventory');x.hidden=!x.hidden;if(!x.hidden)renderBag()}
$('closeBag').onclick=toggleBag;

// ---------- PLAYER / CAMERA ----------
function updatePlayer(dt){
  const d=new THREE.Vector3(); if(keys.KeyW)d.z--; if(keys.KeyS)d.z++; if(keys.KeyA)d.x--; if(keys.KeyD)d.x++; d.x+=mx; d.z-=my;
  const moving=d.lengthSq()>0.0001;
  if(moving){d.normalize(); const yaw=player.rotation.y; d.applyAxisAngle(new THREE.Vector3(0,1,0),yaw); const speed=sprinting||keys.ShiftLeft?10:stance==='crouch'?3.5:6; player.position.addScaledVector(d,speed*dt); player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,Math.atan2(d.x,d.z),Math.min(1,10*dt));}
  if((keys.Space||jumpQueued)&&player.position.y<=.01){player.userData.vy=8;jumpQueued=false}
  player.userData.vy=(player.userData.vy||0)-22*dt; player.position.y+=player.userData.vy*dt; if(player.position.y<0){player.position.y=0;player.userData.vy=0}
  player.position.x=THREE.MathUtils.clamp(player.position.x,-620,620);player.position.z=THREE.MathUtils.clamp(player.position.z,-620,620);
  if(mixer){const speedNow=moving?(sprinting||keys.ShiftLeft?2:1):0;playAction(speedNow>1.5?runAction:speedNow>0?walkAction:idleAction);mixer.update(dt)}
  const h=stance==='crouch'?1.6:2.2,dist=ads?3.7:6.3;
  const off=new THREE.Vector3(0,h,dist).applyAxisAngle(new THREE.Vector3(1,0,0),-pitch).applyAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y);
  camera.position.lerp(player.position.clone().add(off),.09);
  const look=player.position.clone().add(new THREE.Vector3(0,1.25,0)); look.add(new THREE.Vector3(0,0,-3.2).applyAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y)); look.y+=Math.sin(pitch)*3.2; camera.lookAt(look);
}

// ---------- INPUT ----------
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR')reload();if(e.code>='Digit1'&&e.code<='Digit3'){wi=+e.code.at(-1)-1;ammo=weapons[wi].mag;reserve=weapons[wi].reserve;hud()}if(e.code==='KeyB')toggleBag();if(e.code==='KeyE')pickup()});
addEventListener('keyup',e=>keys[e.code]=false); addEventListener('mousedown',e=>{if(e.button===0)shooting=true}); addEventListener('mouseup',e=>{if(e.button===0)shooting=false});
renderer.domElement.addEventListener('click',()=>{if(!touch&&!document.pointerLockElement)renderer.domElement.requestPointerLock()});
addEventListener('mousemove',e=>{if(document.pointerLockElement){player.rotation.y-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0018,-1.15,.65)}});

function stick(e){const r=$('leftStick').getBoundingClientRect(),max=r.width*.34;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,l=Math.hypot(x,y);if(l>max){x=x/l*max;y=y/l*max}mx=x/max;my=y/max;$('stickKnob').style.transform=`translate(${x}px,${y}px)`}
function resetStick(){$('stickKnob').style.transform='translate(0,0)';mx=my=0}
$('leftStick').addEventListener('pointerdown',e=>{$('leftStick').setPointerCapture(e.pointerId);stick(e)});$('leftStick').addEventListener('pointermove',e=>stick(e));$('leftStick').addEventListener('pointerup',resetStick);$('leftStick').addEventListener('pointercancel',resetStick);
let lid=null,lx=0,ly=0;$('lookZone').addEventListener('pointerdown',e=>{lid=e.pointerId;lx=e.clientX;ly=e.clientY;$('lookZone').setPointerCapture(e.pointerId)});$('lookZone').addEventListener('pointermove',e=>{if(e.pointerId!==lid)return;player.rotation.y-=(e.clientX-lx)*.006;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-ly)*.004,-1.15,.65);lx=e.clientX;ly=e.clientY});$('lookZone').addEventListener('pointerup',()=>lid=null);$('lookZone').addEventListener('pointercancel',()=>lid=null);
const hold=(id,on,off)=>{const e=$(id);e.onpointerdown=x=>{on();x.preventDefault()};e.onpointerup=off;e.onpointercancel=off};
hold('fire',()=>shooting=true,()=>shooting=false);hold('ads',()=>{ads=true;camera.fov=52;camera.updateProjectionMatrix()},()=>{ads=false;camera.fov=68;camera.updateProjectionMatrix()});
$('jump').onpointerdown=()=>jumpQueued=true;$('reload').onpointerdown=reload;$('bag').onpointerdown=toggleBag;$('gun').onpointerdown=()=>{wi=(wi+1)%weapons.length;ammo=weapons[wi].mag;reserve=weapons[wi].reserve;hud()};$('stance').onpointerdown=()=>{stance=stance==='stand'?'crouch':'stand';$('stance').textContent=stance==='stand'?'CROUCH':'STAND'};

$('playBtn').onclick=()=>start();$('trainingBtn').onclick=()=>start('TRAINING');
function start(mode='MATCH'){$('menu').style.display='none';$('hud').hidden=false;localStorage.setItem('BR3D_PLAYER_NAME',$('playerName').value||'Player');msg(`${mode} STARTED`);hud()}
async function auth(){try{const c=await (await fetch('/auth/config')).json();if(c.googleClientId&&window.google?.accounts?.id){google.accounts.id.initialize({client_id:c.googleClientId,callback:async x=>{const r=await fetch('/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:x.credential})});const d=await r.json();if(d.user){$('playerName').value=d.user.name.slice(0,16);$('loginStatus').textContent='Logged in with Google'}}});google.accounts.id.renderButton($('googleLogin'),{theme:'filled_black',size:'large',width:320})}}catch(e){}}
$('facebookLogin').onclick=()=>{if(!window.FB){msg('Facebook login not configured');return}FB.login(r=>{if(r.authResponse)$('loginStatus').textContent='Facebook login authorized'},{scope:'public_profile'})};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function loop(){const dt=Math.min(clock.getDelta(),.05);updatePlayer(dt);if(shooting)shoot();for(const o of loots)o.rotation.y+=dt*1.5;hud();renderer.render(scene,camera)}
renderer.setAnimationLoop(loop);auth();
