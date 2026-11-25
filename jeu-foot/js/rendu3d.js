/* Rendu 3D du match avec Three.js : stade, pelouse, buts, joueurs animés, ballon, caméras.
   Ne fait que dessiner l'état du moteur (moteur.js) : aucune règle du jeu ici. */
import * as THREE from 'three';
import { W, H, GOAL_W, BAR, BOX_D, BOX_W, SIX_D, SIX_W, CIRCLE } from './moteur.js';

export const KITS = [
  { shirt: 0x1f6fff, shorts: 0xf4f6fb, socks: 0x1f6fff, gk: 0x22d3b6, gkShorts: 0x1d1d1d, num: '#ffffff', css: '#4b8dff' },
  { shirt: 0xe63946, shorts: 0x151515, socks: 0xe63946, gk: 0xffb703, gkShorts: 0x1d1d1d, num: '#ffffff', css: '#ff5a5f' }
];
const SKINS = [0xf1c7a3, 0xd9a07a, 0xb77a52, 0x8a5636, 0x5e3a24, 0xc98e65, 0x6f4428];
const HAIRS = [0x1b120c, 0x3a2416, 0x0d0d0d, 0x6b4423, 0xc9a36b, 0x222222, 0x120a05];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* Repère : x du moteur -> x, y du moteur -> z, hauteur -> y. Centre du terrain en (0,0,0). */
const V3 = (x, y, z = 0) => new THREE.Vector3(x - W / 2, z, y - H / 2);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- pelouse et lignes, dessinées sur une texture ---------- */
function pitchTexture() {
  const px = 20, M = 4, cw = (W + 2 * M) * px, ch = (H + 2 * M) * px;
  return canvasTex(cw, ch, (g) => {
    const X = x => (x + M) * px, Y = y => (y + M) * px;
    for (let i = 0; i < (W + 2 * M) / 5; i++) { g.fillStyle = i % 2 ? '#2f9a55' : '#288b4b'; g.fillRect(i * 5 * px, 0, 5 * px + 1, ch); }
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.035)'; g.fillRect(Math.random() * cw, Math.random() * ch, 2, 6); }
    g.strokeStyle = 'rgba(255,255,255,.93)'; g.fillStyle = 'rgba(255,255,255,.93)'; g.lineWidth = 0.12 * px;
    const line = (pts, close) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); if (close) g.closePath(); g.stroke(); };
    const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(X(x), Y(y), r * px, a0, a1); g.stroke(); };
    const dot = (x, y, r) => { g.beginPath(); g.arc(X(x), Y(y), r * px, 0, 7); g.fill(); };
    line([[0, 0], [W, 0], [W, H], [0, H]], true); line([[W / 2, 0], [W / 2, H]]);
    arc(W / 2, H / 2, CIRCLE, 0, 7); dot(W / 2, H / 2, 0.25);
    for (const s of [0, 1]) {
      const gx = s ? W : 0, d = s ? -1 : 1;
      line([[gx, H / 2 - BOX_W / 2], [gx + d * BOX_D, H / 2 - BOX_W / 2], [gx + d * BOX_D, H / 2 + BOX_W / 2], [gx, H / 2 + BOX_W / 2]]);
      line([[gx, H / 2 - SIX_W / 2], [gx + d * SIX_D, H / 2 - SIX_W / 2], [gx + d * SIX_D, H / 2 + SIX_W / 2], [gx, H / 2 + SIX_W / 2]]);
      const px11 = gx + d * 11, a = Math.acos((BOX_D - 11) / CIRCLE);
      dot(px11, H / 2, 0.22); if (s) arc(px11, H / 2, CIRCLE, Math.PI - a, Math.PI + a); else arc(px11, H / 2, CIRCLE, -a, a);
    }
    arc(0, 0, 1, 0, Math.PI / 2); arc(W, 0, 1, Math.PI / 2, Math.PI); arc(W, H, 1, Math.PI, Math.PI * 1.5); arc(0, H, 1, Math.PI * 1.5, Math.PI * 2);
  });
}

function boardTexture() {
  const t = canvasTex(1024, 64, (g, w, h) => {
    const items = [['KKG FOR INNOVATION', '#0e3d8a'], ['FOOT PROFILS', '#c81d25'], ['100 POINTS', '#111827'], ['FOOT PROFILS', '#0f7a3d']];
    items.forEach(([txt, bg], i) => { g.fillStyle = bg; g.fillRect(i * w / 4, 0, w / 4, h); g.fillStyle = '#fff'; g.font = '800 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, i * w / 4 + w / 8, h / 2 + 2); });
  });
  t.wrapS = THREE.RepeatWrapping; return t;
}

function netTexture() {
  const t = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function ballTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1b1b';
    const spots = [[0.1, 0.5], [0.35, 0.25], [0.35, 0.75], [0.6, 0.5], [0.85, 0.25], [0.85, 0.75], [0.6, 0.05], [0.1, 0.95], [0.1, 0.05], [0.6, 0.95]];
    for (const [u, v] of spots) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(u * w + Math.cos(a) * 15, v * h + Math.sin(a) * 13); } g.closePath(); g.fill(); }
  });
}

function numberTexture(n, color) {
  return canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = color; g.font = '900 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 3); });
}

/* ---------- tribunes avec public ---------- */
function buildStand(len, rows, palette, withRoof) {
  const grp = new THREE.Group(), stepH = 0.55, stepD = 0.9;
  const concrete = new THREE.MeshLambertMaterial({ color: 0x4a515c }), seat = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  for (let r = 0; r < rows; r++) {
    const h = (r + 1) * stepH, m = new THREE.Mesh(new THREE.BoxGeometry(len, h, stepD), r % 2 ? concrete : seat);
    m.position.set(0, h / 2, -r * stepD); grp.add(m);
  }
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, rows * stepH + 4, 0.6), concrete); wall.position.set(0, (rows * stepH + 4) / 2, -rows * stepD); grp.add(wall);
  if (withRoof) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.4, rows * stepD + 3), new THREE.MeshLambertMaterial({ color: 0xd9dde3 }));
    roof.position.set(0, rows * stepH + 5, -rows * stepD / 2 + 1); grp.add(roof);
    for (let x = -len / 2; x <= len / 2; x += len / 6) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, rows * stepH + 5), concrete); c.position.set(x, (rows * stepH + 5) / 2, -rows * stepD + 0.5); grp.add(c); }
  }
  const per = Math.floor(len / 0.72), count = rows * per;
  const fan = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.72, 0.32), new THREE.MeshLambertMaterial(), count);
  const mtx = new THREE.Matrix4(), col = new THREE.Color(), base = [];
  let i = 0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
    const x = -len / 2 + 0.36 + k * 0.72 + (Math.random() - 0.5) * 0.12, y = (r + 1) * stepH + 0.36, z = -r * stepD - 0.05;
    const empty = Math.random() < 0.12;
    mtx.makeTranslation(x, empty ? -50 : y, z); fan.setMatrixAt(i, mtx); base.push([x, empty ? -50 : y, z, Math.random() * 6]);
    col.set(palette[(Math.random() * palette.length) | 0]); fan.setColorAt(i, col); i++;
  }
  fan.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(fan);
  return { grp, fan, base };
}

/* ---------- joueur 3D articulé (primitives, animation procédurale) ---------- */
const GEO = {};
function geos() {
  if (GEO.torso) return GEO;
  GEO.torso = new THREE.CapsuleGeometry(0.17, 0.34, 4, 10);
  GEO.shorts = new THREE.CylinderGeometry(0.17, 0.15, 0.24, 10);
  GEO.thigh = new THREE.CapsuleGeometry(0.075, 0.28, 4, 8);
  GEO.shin = new THREE.CapsuleGeometry(0.06, 0.3, 4, 8);
  GEO.boot = new THREE.BoxGeometry(0.11, 0.08, 0.26);
  GEO.upper = new THREE.CapsuleGeometry(0.055, 0.2, 4, 8);
  GEO.fore = new THREE.CapsuleGeometry(0.048, 0.2, 4, 8);
  GEO.head = new THREE.SphereGeometry(0.12, 14, 12);
  GEO.hair = new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  GEO.neck = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
  GEO.num = new THREE.PlaneGeometry(0.26, 0.26);
  return GEO;
}
const MATS = new Map();
function mat(color) { if (!MATS.has(color)) MATS.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 })); return MATS.get(color); }

function makePlayer(p) {
  const G = geos(), kit = KITS[p.team], gk = p.slot === 'GK';
  const shirt = mat(gk ? kit.gk : kit.shirt), shorts = mat(gk ? kit.gkShorts : kit.shorts), socks = mat(gk ? kit.gk : kit.socks);
  const skin = mat(SKINS[p.id % SKINS.length]), hair = mat(HAIRS[(p.id * 3) % HAIRS.length]), boot = mat(0x111111);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mesh = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; (parent || body).add(o); return o; };
  const torso = new THREE.Group(); torso.position.y = 0.95; body.add(torso);
  const t = mesh(G.torso, shirt, 0, 0.3, 0, torso); t.scale.set(1.25, 1, 0.8);
  mesh(G.neck, skin, 0, 0.58, 0, torso);
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  mesh(G.head, skin, 0, 0, 0, head); mesh(G.hair, hair, 0, 0.012, -0.005, head);
  const num = new THREE.Mesh(G.num, new THREE.MeshBasicMaterial({ map: numberTexture(p.numero, gk ? '#06302a' : kit.num), transparent: true }));
  num.position.set(0, 0.33, -0.142); num.rotation.y = Math.PI; torso.add(num);
  mesh(G.shorts, shorts, 0, 0.94, 0).scale.set(1.15, 1, 0.85);
  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.09, 0.92, 0); body.add(hip);
    mesh(G.thigh, side > 0 ? skin : skin, 0, -0.2, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    mesh(G.shin, socks, 0, -0.2, 0, knee); mesh(G.boot, boot, 0, -0.43, 0.05, knee);
    return { hip, knee };
  };
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.24, 0.5, 0); torso.add(sh);
    mesh(G.upper, shirt, 0, -0.13, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    mesh(G.fore, gk ? mat(0xf5f5f5) : skin, 0, -0.12, 0, el);
    sh.rotation.z = side * 0.12; return { sh, el };
  };
  const L = leg(-1), R = leg(1), AL = arm(-1), AR = arm(1);
  return { root, body, torso, head, L, R, AL, AR, ph: Math.random() * 6, kick: -1e9, heading: p.team === 0 ? Math.PI / 2 : -Math.PI / 2 };
}

export class Rendu3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
    this.camTarget = new THREE.Vector3(); this.camInit = false;
    this.buildWorld();
    this.players = []; this.match = null; this.humanId = -1; this.celebrateUntil = 0;
  }
  buildWorld() {
    const s = this.scene;
    s.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5b9be0'); gr.addColorStop(0.6, '#b9d7f0'); gr.addColorStop(1, '#e9e3d2'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    s.fog = new THREE.Fog(0xcfe0ee, 140, 320);
    s.add(new THREE.HemisphereLight(0xcfe6ff, 0x2f5d32, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.set(-35, 70, 30); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 45, bottom: -45, near: 10, far: 200 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; s.add(sun); s.add(sun.target); this.sun = sun;
    /* sol autour du stade et pelouse */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x3d4a3a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; s.add(ground);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 24, H + 24), new THREE.MeshLambertMaterial({ color: 0x25803f })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; s.add(apron);
    const pt = pitchTexture(); pt.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, H + 8), new THREE.MeshLambertMaterial({ map: pt })); pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; s.add(pitch);
    /* panneaux publicitaires */
    const bt = boardTexture(), boards = [[0, -H / 2 - 4, W + 14, 0], [0, H / 2 + 4, W + 14, Math.PI], [-W / 2 - 5, 0, H + 6, Math.PI / 2], [W / 2 + 5, 0, H + 6, -Math.PI / 2]];
    for (const [x, z, len, ry] of boards) {
      const tex = bt.clone(); tex.needsUpdate = true; tex.repeat.set(len / 36, 1);
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.12), [mat(0x222222), mat(0x222222), mat(0x222222), mat(0x222222), new THREE.MeshBasicMaterial({ map: tex }), mat(0x222222)]);
      b.position.set(x, 0.45, z); b.rotation.y = ry; s.add(b);
    }
    /* tribunes : en face et derrière les buts (le côté caméra reste ouvert) */
    const pal = ['#1f6fff', '#1f6fff', '#e63946', '#e63946', '#f2f2f2', '#ffd23f', '#2b2b2b', '#7a7a7a', '#ff8fa3', '#3ddc84', '#9c6bff', '#f4a261'];
    this.stands = [];
    const far = buildStand(W + 30, 16, pal, true); far.grp.position.set(0, 0, -H / 2 - 8); s.add(far.grp); this.stands.push(far);
    const left = buildStand(H + 14, 14, pal, false); left.grp.position.set(-W / 2 - 9, 0, 0); left.grp.rotation.y = Math.PI / 2; s.add(left.grp); this.stands.push(left);
    const right = buildStand(H + 14, 14, pal, false); right.grp.position.set(W / 2 + 9, 0, 0); right.grp.rotation.y = -Math.PI / 2; s.add(right.grp); this.stands.push(right);
    /* pylônes d'éclairage */
    for (const [x, z] of [[-W / 2 - 14, -H / 2 - 14], [W / 2 + 14, -H / 2 - 14], [-W / 2 - 14, H / 2 + 14], [W / 2 + 14, H / 2 + 14]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 34), mat(0x9aa3ad)); pole.position.set(x, 17, z); s.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.6 }));
      head.position.set(x, 35, z); head.lookAt(0, 0, 0); s.add(head);
    }
    /* buts */
    for (const side of [0, 1]) s.add(this.buildGoal(side));
    /* ballon */
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.ball.castShadow = true; s.add(this.ball); this.ballSpin = new THREE.Quaternion();
    /* anneau sous le joueur humain */
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03; s.add(this.ring);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 3), new THREE.MeshBasicMaterial({ color: 0xffd23f })); this.arrow.rotation.x = Math.PI; s.add(this.arrow);
  }
  buildGoal(side) {
    const g = new THREE.Group(), d = side ? 1 : -1, white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    g.position.set(side ? W / 2 : -W / 2, 0, 0);
    const post = new THREE.CylinderGeometry(0.06, 0.06, BAR, 12);
    for (const z of [-GOAL_W / 2, GOAL_W / 2]) { const p = new THREE.Mesh(post, white); p.position.set(0, BAR / 2, z); p.castShadow = true; g.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_W + 0.12, 12), white); bar.rotation.x = Math.PI / 2; bar.position.set(0, BAR, 0); bar.castShadow = true; g.add(bar);
    const depth = 2, nt = netTexture(), netMat = (rx, ry) => { const t = nt.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }); };
    const back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, BAR * 0.85), netMat(GOAL_W / 0.15, BAR / 0.15)); back.rotation.y = Math.PI / 2; back.position.set(d * depth, BAR * 0.425, 0); g.add(back);
    const topLen = Math.hypot(depth, BAR * 0.15), top = new THREE.Mesh(new THREE.PlaneGeometry(topLen, GOAL_W), netMat(topLen / 0.15, GOAL_W / 0.15));
    top.rotation.x = -Math.PI / 2; top.rotation.y = -d * Math.atan2(BAR * 0.15, depth); top.position.set(d * depth / 2, BAR * 0.925, 0); g.add(top);
    for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
      const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(d * depth, 0), new THREE.Vector2(d * depth, BAR * 0.85), new THREE.Vector2(0, BAR)]);
      const sideNet = new THREE.Mesh(new THREE.ShapeGeometry(shape), netMat(1, 1));
      const uv = sideNet.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, sideNet.geometry.attributes.position.getX(i) / 0.15, sideNet.geometry.attributes.position.getY(i) / 0.15);
      sideNet.position.z = z; g.add(sideNet);
    }
    const supp = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    for (const z of [-GOAL_W / 2, GOAL_W / 2]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, BAR * 0.85), supp); sp.position.set(d * depth, BAR * 0.425, z); g.add(sp); }
    return g;
  }
  setMatch(match, humanId) {
    for (const pl of this.players) this.scene.remove(pl.root);
    this.match = match; this.humanId = humanId; this.camInit = false;
    this.players = match.players.map(p => { const o = makePlayer(p); this.scene.add(o.root); return o; });
  }
  setShadows(on) { this.sun.castShadow = on; }
  kick(id) { if (this.players[id]) this.players[id].kick = performance.now(); }
  celebrate() { this.celebrateUntil = performance.now() + 3500; }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (this.w !== w || this.h !== h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px'; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }
  ballPos() {
    const m = this.match, b = m.ball;
    if (b.owner >= 0) { const o = m.players[b.owner], a = this.players[o.id], dd = 0.5 + 0.25 * Math.abs(Math.sin(a.ph * 0.5)); return [o.x + o.fx * dd, o.y + o.fy * dd, 0]; }
    return [b.x, b.y, b.z];
  }
  update(dt, opts) {
    this.resize();
    const m = this.match, now = performance.now();
    for (const p of m.players) {
      const a = this.players[p.id], sp = Math.hypot(p.vx, p.vy), amp = Math.min(1, sp / 6.5);
      a.root.position.set(p.x - W / 2, 0, p.y - H / 2);
      const target = Math.atan2(p.fx, p.fy); let diff = target - a.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); a.heading += diff * Math.min(1, dt * 12);
      a.root.rotation.y = a.heading;
      a.ph += sp * dt * 2.4;
      const s1 = Math.sin(a.ph);
      a.L.hip.rotation.x = s1 * 0.85 * amp; a.R.hip.rotation.x = -s1 * 0.85 * amp;
      a.L.knee.rotation.x = amp * (0.25 + 0.9 * Math.max(0, Math.sin(a.ph + 1.6))) + 0.05;
      a.R.knee.rotation.x = amp * (0.25 + 0.9 * Math.max(0, Math.sin(a.ph + 1.6 + Math.PI))) + 0.05;
      a.AL.sh.rotation.x = -s1 * 0.7 * amp; a.AR.sh.rotation.x = s1 * 0.7 * amp;
      a.AL.el.rotation.x = a.AR.el.rotation.x = -0.25 - 0.8 * amp;
      a.torso.rotation.x = 0.14 * amp; a.body.position.y = Math.abs(Math.cos(a.ph)) * 0.05 * amp;
      const k = (now - a.kick) / 260;
      if (k >= 0 && k < 1) { a.R.hip.rotation.x = -1.4 * Math.sin(k * Math.PI); a.R.knee.rotation.x = 0.9 * Math.sin(k * Math.PI * 0.7 + 0.6) * (1 - k); a.AL.sh.rotation.x = -0.8 * Math.sin(k * Math.PI); }
      if (p.slot === 'GK' && sp < 1) { a.AL.sh.rotation.z = -0.5; a.AR.sh.rotation.z = 0.5; a.L.knee.rotation.x = a.R.knee.rotation.x = 0.35; a.torso.rotation.x = 0.18; }
      else { a.AL.sh.rotation.z = -0.12; a.AR.sh.rotation.z = 0.12; }
      a.body.rotation.z = p.stun > 0.3 ? Math.sin(now / 60) * 0.12 : 0;
    }
    /* ballon : position + rotation selon la vitesse */
    const [bx, by, bz] = this.ballPos(), pos = V3(bx, by, bz + 0.17), prev = this.ball.position.clone();
    this.ball.position.copy(pos);
    const mv = pos.clone().sub(prev); mv.y = 0; const dist = mv.length();
    if (dist > 1e-4 && dist < 3) { const axis = new THREE.Vector3(mv.z, 0, -mv.x).normalize(); this.ballSpin.setFromAxisAngle(axis, dist / 0.17); this.ball.quaternion.premultiply(this.ballSpin); }
    /* repère du joueur humain */
    const me = m.players[this.humanId], pu = 1 + 0.08 * Math.sin(now / 170);
    this.ring.position.set(me.x - W / 2, 0.03, me.y - H / 2); this.ring.scale.set(pu, pu, pu);
    this.arrow.position.set(me.x - W / 2, 2.35 + 0.08 * Math.sin(now / 200), me.y - H / 2); this.arrow.rotation.y += dt * 2;
    /* public qui saute après un but */
    const cel = now < this.celebrateUntil, mtx = new THREE.Matrix4();
    for (const st of this.stands) {
      if (!cel && !st.dirty) continue;
      st.base.forEach(([x, y, z, ph], i) => { mtx.makeTranslation(x, cel ? y + Math.max(0, Math.sin(now / 110 + ph)) * 0.35 : y, z); st.fan.setMatrixAt(i, mtx); });
      st.fan.instanceMatrix.needsUpdate = true; st.dirty = cel;
    }
    this.updateCamera(dt, opts.cam);
    this.renderer.render(this.scene, this.camera);
  }
  updateCamera(dt, mode) {
    const portrait = this.h > this.w, m = this.match, [bx, by] = this.ballPos(), b = m.ball, cam = this.camera;
    let tx, tz;
    if (mode === 'tac') {
      cam.fov = portrait ? 62 : 42; cam.updateProjectionMatrix();
      const dist = portrait ? 78 : 72; cam.up.set(portrait ? 1 : 0, 0, portrait ? 0 : -1);
      cam.position.set(0, dist, portrait ? 0 : 0.01); cam.lookAt(0, 0, 0); return;
    }
    cam.up.set(0, 1, 0);
    const own = b.owner >= 0 ? m.players[b.owner] : null, lead = own ? [own.vx * 0.9, own.vy * 0.5] : [b.vx * 0.35, b.vy * 0.2];
    tx = bx - W / 2 + lead[0]; tz = by - H / 2 + lead[1];
    if (portrait) { tx = clamp(tx, -W / 2 + 4, W / 2 - 4); tz = clamp(tz * 0.85, -H / 2 + 8, H / 2 - 8); }
    else { tx = clamp(tx, -W / 2 + 13, W / 2 - 13); tz = clamp(tz * 0.6, -H / 2 + 10, H / 2 - 8); }
    if (!this.camInit) { this.camTarget.set(tx, 0, tz); this.camInit = true; }
    const k = 1 - Math.exp(-dt * 3); this.camTarget.x += (tx - this.camTarget.x) * k; this.camTarget.z += (tz - this.camTarget.z) * k;
    const t = this.camTarget;
    if (portrait) { cam.fov = 50; cam.position.set(t.x - 20, 21, t.z); cam.lookAt(t.x + 6, 0, t.z); }
    else { cam.fov = 32; cam.position.set(t.x, 14, t.z + 29); cam.lookAt(t.x, 0, t.z - 3); }
    cam.updateProjectionMatrix();
  }
  /* Convertit une direction d'écran (joystick : droite, bas) en direction sur le terrain (mx, my du moteur) */
  screenDirToWorld(jx, jy) {
    if (!jx && !jy) return [0, 0];
    const me = this.match.players[this.humanId], a = V3(me.x, me.y).project(this.camera), ex = V3(me.x + 1, me.y).project(this.camera), ez = V3(me.x, me.y + 1).project(this.camera);
    const w = this.w || 1, h = this.h || 1, e1 = [(ex.x - a.x) * w, -(ex.y - a.y) * h], e2 = [(ez.x - a.x) * w, -(ez.y - a.y) * h];
    const det = e1[0] * e2[1] - e2[0] * e1[1]; if (Math.abs(det) < 1e-9) return [jx, jy];
    let u = (jx * e2[1] - e2[0] * jy) / det, v = (e1[0] * jy - jx * e1[1]) / det;
    const l = Math.hypot(u, v) || 1, mag = Math.min(1, Math.hypot(jx, jy)); return [u / l * mag, v / l * mag];
  }
  /* Position écran (pixels CSS) d'un point du terrain, ou null s'il est derrière la caméra */
  toScreen(x, y, z) {
    const p = V3(x, y, z).project(this.camera); if (p.z > 1) return null;
    return [(p.x + 1) / 2 * this.w, (1 - p.y) / 2 * this.h];
  }
}
