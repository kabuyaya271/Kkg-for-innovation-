// Visite intérieure en première personne (voir specs/002-visite-interieure).
// La maquette GLB fournit les repères : visite-entree-N / visite-dedans-N (libelle),
// visite-piece-N (libelle, niveau), sols praticables « sol-… », vantaux « porte-… ».
import * as THREE from 'three';

const YEUX = 1.6;            // hauteur des yeux au-dessus du sol (m)
const MARCHE_MAX = 0.4;      // hauteur de marche franchissable (m)
const RAYON = 0.3;           // distance mini aux obstacles (m)
const VITESSE = 1.7;         // m/s
const NIVEAUX = ['Rez-de-chaussée', '1er étage', '2e étage', '3e étage', '4e étage', '5e étage'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Visite {
  /** Indique si la maquette contient des repères de visite. */
  static disponible(racine) {
    let ok = false;
    racine?.traverse((o) => { if (/^visite-entree-\d+/.test(o.name)) ok = true; });
    return ok;
  }

  constructor(viewer, scene) {
    this.v = viewer; this.sceneEl = scene;
    this.actif = false; this.interieur = false;
    this.yaw = 0; this.pitch = 0; this.pieds = new THREE.Vector3();
    this.touches = new Set(); this.cible = null; this.anim = null;
    this.ray = new THREE.Raycaster();
    this._lire();
    this._ui();
  }

  // ------------------------------------------------------------ repères et maillages
  _lire() {
    const racine = this.v.modele; racine.updateMatrixWorld(true);
    const p = (o) => o.getWorldPosition(new THREE.Vector3());
    const entrees = {}, dedans = {};
    this.pieces = []; this.sols = []; this.obstacles = [];
    racine.traverse((o) => {
      let m;
      if ((m = /^visite-entree-(\d+)/.exec(o.name))) entrees[m[1]] = { libelle: o.userData.libelle || `Entrée ${m[1]}`, dehors: p(o) };
      else if ((m = /^visite-dedans-(\d+)/.exec(o.name))) dedans[m[1]] = p(o);
      else if (/^visite-piece-\d+/.test(o.name)) this.pieces.push({ libelle: o.userData.libelle || 'Pièce', niveau: +(o.userData.niveau || 0), pos: p(o) });
      else if (o.isMesh) {
        const nom = this._nom(o);
        if (nom.startsWith('sol')) this.sols.push(o);
        else if (!nom.startsWith('porte') && !nom.startsWith('decor')) {
          o.geometry.computeBoundingSphere();
          const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
          this.obstacles.push({ o, s });
        }
      }
    });
    this.entrees = Object.keys(entrees).filter((k) => dedans[k]).sort((a, b) => a - b).map((k) => ({ ...entrees[k], dedans: dedans[k] }));
  }

  /** Nom logique d'un maillage : celui du maillage ou de son nœud parent (les primitives glTF portent parfois un suffixe). */
  _nom(o) {
    let n = o; for (let i = 0; i < 3 && n; i++, n = n.parent) { if (/^(sol|porte|decor|meuble|mur)/.test(n.name)) return n.name; }
    return o.name || '';
  }

  // ------------------------------------------------------------ interface
  _ui() {
    const z = document.createElement('div'); z.className = 'visite-calque'; z.hidden = true;
    z.innerHTML = this.entrees.map((e, i) => `<button class="visite-pastille" data-i="${i}"><span>⤵</span>${esc(e.libelle)}</button>`).join('');
    this.sceneEl.appendChild(z); this.calque = z;
    z.addEventListener('click', (ev) => { const b = ev.target.closest('.visite-pastille'); if (b) this.entrer(+b.dataset.i); });

    const parNiveau = {};
    for (const [i, p] of this.pieces.entries()) (parNiveau[p.niveau] ||= []).push([i, p]);
    const panneau = document.createElement('div'); panneau.className = 'visite-panneau'; panneau.hidden = true;
    panneau.innerHTML = `
      <strong>Visite intérieure</strong>
      <select class="visite-choix-entree" aria-label="Entrer par"><option value="">Entrer par…</option>${this.entrees.map((e, i) => `<option value="${i}">${esc(e.libelle)}</option>`).join('')}</select>
      <select class="visite-choix-piece" aria-label="Aller à une pièce"><option value="">Aller à une pièce…</option>${Object.keys(parNiveau).sort((a, b) => a - b).map((n) =>
        `<optgroup label="${esc(NIVEAUX[n] || `Niveau ${n}`)}">${parNiveau[n].map(([i, p]) => `<option value="${i}">${esc(p.libelle)}</option>`).join('')}</optgroup>`).join('')}</select>
      <button class="visite-entrees">Entrées</button>
      <button class="visite-sortir">Sortir</button>
      <small class="visite-aide">Glissez pour regarder · touchez le sol pour y aller · flèches / ZQSD pour marcher</small>`;
    this.sceneEl.appendChild(panneau); this.panneau = panneau;
    panneau.querySelector('.visite-choix-piece').addEventListener('change', (ev) => { if (ev.target.value !== '') this.aller(+ev.target.value); ev.target.value = ''; });
    panneau.querySelector('.visite-choix-entree').addEventListener('change', (ev) => { if (ev.target.value !== '') this.entrer(+ev.target.value); ev.target.value = ''; });
    panneau.querySelector('.visite-sortir').addEventListener('click', () => this.desactiver());
    panneau.querySelector('.visite-entrees').addEventListener('click', () => this.dehors());

    const pad = document.createElement('div'); pad.className = 'visite-pad'; pad.hidden = true;
    pad.innerHTML = ['avant:▲', 'gauche:◀', 'droite:▶', 'arriere:▼'].map((s) => { const [k, t] = s.split(':'); return `<button data-k="${k}" aria-label="${k}">${t}</button>`; }).join('');
    this.sceneEl.appendChild(pad); this.pad = pad;
    const appui = (ev, on) => { const b = ev.target.closest('button[data-k]'); if (!b) return; ev.preventDefault(); on ? this.touches.add('pad-' + b.dataset.k) : this.touches.delete('pad-' + b.dataset.k); };
    pad.addEventListener('pointerdown', (e) => appui(e, true)); ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => pad.addEventListener(t, (e) => appui(e, false)));

    // regard + toucher le sol
    const c = this.v.renderer.domElement;
    c.addEventListener('pointerdown', (e) => { if (!this.interieur) return; this._glisse = { x: e.clientX, y: e.clientY, d: 0 }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!this.interieur || !this._glisse) return;
      const dx = e.clientX - this._glisse.x, dy = e.clientY - this._glisse.y;
      this._glisse.x = e.clientX; this._glisse.y = e.clientY; this._glisse.d += Math.abs(dx) + Math.abs(dy);
      this.yaw += dx * 0.005; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, -1.2, 1.2); this.cible = null;
    });
    c.addEventListener('pointerup', (e) => { if (!this.interieur || !this._glisse) return; if (this._glisse.d < 6) this._toucher(e); this._glisse = null; });
    this._clavier = (e) => {
      if (!this.interieur || /input|select|textarea/i.test(e.target.tagName)) return;
      const k = { ArrowUp: 'avant', z: 'avant', w: 'avant', ArrowDown: 'arriere', s: 'arriere', ArrowLeft: 'gauche', ArrowRight: 'droite', q: 'pasg', a: 'pasg', d: 'pasd' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!k) return; e.preventDefault();
      e.type === 'keydown' ? this.touches.add(k) : this.touches.delete(k); this.cible = null;
    };
    window.addEventListener('keydown', this._clavier); window.addEventListener('keyup', this._clavier);
  }

  _toucher(e) {
    const r = this.v.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.v.camera); this.ray.far = 30;
    const h = this.ray.intersectObjects(this.sols, false)[0];
    if (h && Math.abs(h.point.y - this.pieds.y) < 1.2) this.cible = h.point.clone();
  }

  // ------------------------------------------------------------ modes
  activer() {
    this.actif = true; this.calque.hidden = false; this.panneau.hidden = false;
    this.v.surBoucle = (dt) => this.tick(dt);
    this.sceneEl.classList.add('en-visite');
    this.dehors();
  }

  /** Vue extérieure avec les pastilles d'entrée. */
  dehors() {
    this._lumiere(false); this.interieur = false; this.pad.hidden = true; this.calque.hidden = false;
    this.v.controls.enabled = true; this.v.cadrer();
  }

  desactiver() {
    this.dehors(); this.actif = false; this.calque.hidden = true; this.panneau.hidden = true;
    this.v.surBoucle = null; this.sceneEl.classList.remove('en-visite');
    this.onSortie?.();
  }

  entrer(i) {
    const e = this.entrees[i]; if (!e) return;
    const dir = e.dedans.clone().sub(e.dehors); dir.y = 0; dir.normalize();
    const yaw = Math.atan2(-dir.x, -dir.z);
    const depart = this.v.camera.position.clone();
    this.v.controls.enabled = false; this.calque.hidden = true;
    this._lumiere(true);
    const regardDepart = this.v.controls.target.clone();
    this._animer([
      { de: depart, a: e.dehors, regardDe: regardDepart, regardA: e.dedans, duree: 1.3 },
      { de: e.dehors, a: e.dedans, regardDe: e.dedans, regardA: e.dedans.clone().addScaledVector(dir, 5), duree: 1.2 },
    ], () => { this._placer(e.dedans, yaw, 0); });
  }

  aller(i) {
    const p = this.pieces[i]; if (!p) return;
    if (!this.interieur) { this.v.controls.enabled = false; this.calque.hidden = true; this._lumiere(true); }
    this._placer(p.pos, this.interieur ? this.yaw : 0, 0);
  }

  _placer(oeil, yaw, pitch) {
    this.interieur = true; this.pad.hidden = false; this.cible = null;
    this.yaw = yaw; this.pitch = pitch;
    this.pieds.copy(oeil).y -= YEUX;
    const s = this._sol(this.pieds, 1.0, 4.0); if (s !== null) this.pieds.y = s;
    this._appliquer();
  }

  _animer(etapes, fin) {
    this.anim = { etapes, k: 0, t: 0, fin };
  }

  _lumiere(interieur) {
    const v = this.v;
    if (interieur && !this._sauve) {
      this._sauve = { hemi: v.hemi.intensity, soleil: v.soleil.intensity, ombre: v.soleil.castShadow, fog: v.scene.fog, expo: v.renderer.toneMappingExposure };
      v.soleil.castShadow = false; v.scene.fog = null; v.renderer.toneMappingExposure = Math.min(0.8, this._sauve.expo);
      this.lampe = new THREE.PointLight('#fff3df', 2.5, 9, 1.6); v.camera.add(this.lampe); if (!v.camera.parent) v.scene.add(v.camera);
    } else if (!interieur && this._sauve) {
      v.hemi.intensity = this._sauve.hemi; v.soleil.castShadow = this._sauve.ombre; v.scene.fog = this._sauve.fog; v.renderer.toneMappingExposure = this._sauve.expo;
      v.camera.remove(this.lampe); this.lampe.dispose?.(); this.lampe = null; this._sauve = null;
      v.camera.rotation.set(0, 0, 0);
    }
  }

  // ------------------------------------------------------------ physique
  _sol(pieds, haut = 0.6, bas = 3.5) {
    this.ray.set(new THREE.Vector3(pieds.x, pieds.y + haut, pieds.z), new THREE.Vector3(0, -1, 0)); this.ray.far = haut + bas;
    const h = this.ray.intersectObjects(this.sols, false)[0];
    return h ? h.point.y : null;
  }

  _bloque(depuis, dir, dist) {
    const proches = this.obstacles.filter(({ s }) => s.center.distanceTo(depuis) < s.radius + dist + 1.5).map(({ o }) => o);
    if (!proches.length) return false;
    for (const h of [0.45, 1.2]) {
      for (const a of [0, 0.45, -0.45]) {
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        this.ray.set(new THREE.Vector3(depuis.x, depuis.y + h, depuis.z), d); this.ray.far = dist + RAYON;
        if (this.ray.intersectObjects(proches, false).length) return true;
      }
    }
    return false;
  }

  tick(dt) {
    dt = Math.min(dt, 0.05);
    if (this.anim) {
      const a = this.anim, e = a.etapes[a.k]; a.t += dt / e.duree;
      const u = Math.min(1, a.t), s = u * u * (3 - 2 * u);
      this.v.camera.position.lerpVectors(e.de, e.a, s);
      this.v.camera.lookAt(new THREE.Vector3().lerpVectors(e.regardDe, e.regardA, s));
      if (u >= 1) { a.k++; a.t = 0; if (a.k >= a.etapes.length) { this.anim = null; a.fin?.(); } }
      return;
    }
    if (!this.interieur) { this._pastilles(); return; }
    // déplacement demandé
    const T = this.touches; const avant = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const cote = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (T.has('gauche') || T.has('pad-gauche')) this.yaw += 1.6 * dt;
    if (T.has('droite') || T.has('pad-droite')) this.yaw -= 1.6 * dt;
    let m = new THREE.Vector3();
    if (T.has('avant') || T.has('pad-avant')) m.add(avant);
    if (T.has('arriere') || T.has('pad-arriere')) m.sub(avant);
    if (T.has('pasd')) m.add(cote);
    if (T.has('pasg')) m.sub(cote);
    if (this.cible && m.lengthSq() === 0) {
      const d = this.cible.clone().sub(this.pieds); d.y = 0;
      if (d.length() < 0.15) this.cible = null;
      else {
        m = d.normalize();
        const viser = Math.atan2(-m.x, -m.z); let dy = viser - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 4);
      }
    }
    if (m.lengthSq() > 0) {
      m.normalize(); const pas = VITESSE * dt;
      if (!this._bloque(this.pieds, m, pas)) {
        const essai = this.pieds.clone().addScaledVector(m, pas);
        const s = this._sol(essai);
        if (s !== null && s - this.pieds.y <= MARCHE_MAX) { this.pieds.x = essai.x; this.pieds.z = essai.z; }
        else this.cible = null;
      } else this.cible = null;
    }
    // suivre le sol (descente douce, jamais dans le vide)
    const s = this._sol(this.pieds);
    if (s !== null) this.pieds.y += (s - this.pieds.y) * Math.min(1, dt * 12);
    this._appliquer();
  }

  _appliquer() {
    const c = this.v.camera; c.rotation.order = 'YXZ';
    c.position.set(this.pieds.x, this.pieds.y + YEUX, this.pieds.z);
    c.rotation.set(-this.pitch, this.yaw, 0);
  }

  _pastilles() {
    const c = this.v.camera, el = this.v.renderer.domElement, r = el.getBoundingClientRect(), sr = this.sceneEl.getBoundingClientRect();
    const places = [];
    this.calque.querySelectorAll('.visite-pastille').forEach((b) => {
      const p = this.entrees[+b.dataset.i].dehors.clone().project(c);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      b.style.display = vis ? '' : 'none';
      if (vis) places.push({ b, x: r.left - sr.left + (p.x + 1) / 2 * r.width, y: r.top - sr.top + (1 - p.y) / 2 * r.height, w: b.offsetWidth || 160 });
    });
    // écarte verticalement les pastilles qui se chevauchent
    places.sort((a, b) => a.y - b.y);
    for (let i = 0; i < places.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = places[j], q = places[i];
        if (Math.abs(a.x - q.x) < (a.w + q.w) / 2 + 6 && Math.abs(a.y - q.y) < 34) q.y = a.y + 34;
      }
    }
    for (const q of places) { q.b.style.left = `${q.x}px`; q.b.style.top = `${q.y}px`; }
  }

  detruire() {
    window.removeEventListener('keydown', this._clavier); window.removeEventListener('keyup', this._clavier);
    this.calque.remove(); this.panneau.remove(); this.pad.remove();
  }
}
