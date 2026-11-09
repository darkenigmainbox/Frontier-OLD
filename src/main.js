// Viewer: Three.js scene, sun + haze, orbit camera, UI bound to the generator worker.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMaterials } from './render/materials.js';

const $ = (id) => document.getElementById(id);
const view = $('view');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(view.clientWidth, view.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#a9a58f');
scene.background = SKY;
scene.fog = new THREE.FogExp2(SKY, 0.0022);

const camera = new THREE.PerspectiveCamera(50, view.clientWidth / view.clientHeight, 0.3, 3000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new THREE.HemisphereLight('#c8d0c2', '#5a5340', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd9a0', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const SH = 260;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 1200 });
scene.add(sun, sun.target);

const MATS = createMaterials();
const cityGroup = new THREE.Group();
scene.add(cityGroup);

// Overgrown land around the city
const land = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#56612f', roughness: 1 }));
land.rotation.x = -Math.PI / 2;
land.position.y = -0.05;
land.receiveShadow = true;
scene.add(land);

let cityBox = { size: 360 };
function placeCamera(size) {
  const c = size / 2;
  controls.target.set(c, 6, c);
  camera.position.set(c - size * 0.42, size * 0.09, c + size * 0.48);
  sun.target.position.set(c, 0, c);
  sun.position.set(c - 180, 160, c + 120);
  Object.assign(sun.shadow.camera, { left: -size * 0.62, right: size * 0.62, top: size * 0.62, bottom: -size * 0.62 });
  sun.shadow.camera.updateProjectionMatrix();
  controls.update();
}

// ---------- worker ----------
const worker = new Worker(new URL('./gen/worker.js', import.meta.url), { type: 'module' });
let reqId = 0, pending = null;
worker.onmessage = (e) => {
  const msg = e.data;
  if (!pending || msg.id !== pending.id) return;
  const p = pending; pending = null;
  if (!msg.ok) { $('status').textContent = 'Generation failed: ' + msg.error.split('\n')[0]; console.error(msg.error); return; }
  showCity(msg);
  p.done();
};

function showCity(msg) {
  // clear old meshes
  for (const child of [...cityGroup.children]) {
    child.geometry.dispose();
    cityGroup.remove(child);
  }
  for (const [name, d] of Object.entries(msg.buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.normal, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(d.color, 3));
    g.setIndex(new THREE.BufferAttribute(d.index, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, MATS[name] || MATS.trim);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cityGroup.add(mesh);
  }
  applyVisibility();
  cityBox.size = msg.size;
  land.position.set(msg.size / 2, -0.05, msg.size / 2);
  if (!placed) { placeCamera(msg.size); placed = true; }
  renderBreakdown(msg);
  const s = msg.stats;
  $('stats').textContent =
    `${s.buildings} buildings · ${s.lots} lots · ${s.blocks} blocks\n` +
    `${s.plants} plant groups · ${s.cracksRoad} road cracks\n` +
    `${(s.tris / 1000).toFixed(0)}k triangles · generated in ${(s.ms / 1000).toFixed(1)} s`;
  lastBuildings = msg.buildings;
  lastSeed = s.seed;
}

let placed = false;
let lastBuildings = [];
let lastSeed = '';

function renderBreakdown(msg) {
  const by = (key) => msg.buildings.reduce((m, b) => ((m[b[key]] = (m[b[key]] || 0) + 1), m), {});
  const arch = by('label');
  const dmg = { intact: 0, damaged: 0, ruined: 0 };
  for (const b of msg.buildings) dmg[['intact', 'damaged', 'ruined'][b.damage]]++;
  const dist = msg.districts.map((d) => `  ${d.label}`).join('\n');
  $('breakdown').textContent =
    'Buildings\n' + Object.entries(arch).map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    `\nCondition\n  intact ${dmg.intact} · damaged ${dmg.damaged} · ruined ${dmg.ruined}` +
    `\nDistricts\n${dist}`;
}

function applyVisibility() {
  const show = { crack: $('t-cracks').checked, foliage: $('t-plants').checked, leaf: $('t-plants').checked,
    vine: $('t-plants').checked, grass: $('t-plants').checked, bark: $('t-plants').checked,
    rubble: $('t-props').checked, glass: true };
  for (const m of cityGroup.children) m.visible = show[m.name] ?? true;
}
for (const id of ['t-cracks', 't-plants', 't-props']) $(id).addEventListener('change', applyVisibility);

function generate() {
  const seed = $('seed').value.trim() || 'frontier';
  const id = ++reqId;
  $('status').textContent = 'Generating…';
  const options = {
    density: +$('density').value, damage: +$('damage').value,
    vegetation: +$('veg').value, size: +$('size').value,
  };
  pending = { id, done: () => ($('status').textContent = `Seed “${seed}”`) };
  worker.postMessage({ id, seed, options });
}

function bindOutputs() {
  const pairs = [['density', 'o-density', 2], ['damage', 'o-damage', 2], ['veg', 'o-veg', 2], ['size', 'o-size', 0]];
  for (const [inp, out, d] of pairs) {
    const f = () => ($(out).textContent = (+$(inp).value).toFixed(d));
    $(inp).addEventListener('input', f); f();
  }
}
bindOutputs();
$('generate').addEventListener('click', generate);
$('seed').addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });
$('dice').addEventListener('click', () => {
  $('seed').value = Math.random().toString(36).slice(2, 8) + '-' + Math.floor(Math.random() * 999);
  generate();
});
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ seed: lastSeed, buildings: lastBuildings }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frontier-${lastSeed}.json`;
  a.click();
});

window.addEventListener('resize', () => {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

generate();
window.__frontier = { scene, camera, controls, renderer, generate, cityGroup };
