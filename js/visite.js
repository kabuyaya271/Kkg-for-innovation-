// Visite intérieure en première personne (voir specs/002-visite-interieure).
// La maquette GLB fournit les repères : visite-entree-N / visite-dedans-N (libelle),
// visite-piece-N (libelle, niveau), sols praticables « sol-… », vantaux « porte-… ».
import * as THREE from 'three';

const YEUX = 1.6;            // hauteur des yeux au-dessus du sol (m)
const MARCHE_MAX = 0.4;      // hauteur de marche franchissable (m)
const RAYON = 0.3;           // distance mini aux obstacles (m)
const VITESSE = 1.7;         // m/s
// caméras de la visite : [identifiant, libellé, distance, élévation de base]
const CAMERAS = [['epaule', 'Épaule', 3.2, 0.3], ['large', 'Large', 6.5, 0.7], ['dessus', 'Plan (dessus)', 9, 1.45],
  ['face', 'Face', 2.6, 0.15], ['subjectif', 'Subjective', 0, 0]];
const ICONES = { epaule: '🧍', large: '🔭', dessus: '🗺️', face: '🙂', subjectif: '👁️' };
const NIVEAUX = ['Rez-de-chaussée', '1er étage', '2e étage', '3e étage', '4e étage', '5e étage'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Visite {
  /** Indique si la maquette contient des repères de visite. */
  static disponible(racine) {
    let ok = false;
    racine?.traverse((o) => { if (/^visite-(entree-\d+|depart)/.test(o.name)) ok = true; });
    return ok;
  }

  constructor(viewer, scene) {
    this.v = viewer; this.sceneEl = scene;
    this.actif = false; this.interieur = false;
    this.yaw = 0; this.pitch = 0; this.pieds = new THREE.Vector3();
    this.cam = 0; this.cap = 0; this.pasPhase = 0;   // caméra courante (CAMERAS) ; personnage guidé comme dans GTA
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
      else if (o.name.startsWith('visite-depart')) this.depart = p(o);
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
      <button class="visite-sortir">✕ Quitter</button>
      <button class="visite-menu-btn" aria-expanded="false">☰ Menu</button>
      <div class="visite-menu" hidden>
      <select class="visite-choix-entree" aria-label="Se rendre à une entrée"><option value="">Aller à une entrée…</option>${this.entrees.map((e, i) => `<option value="${i}">${esc(e.libelle)}</option>`).join('')}</select>
      <select class="visite-choix-piece" aria-label="Aller à une pièce"><option value="">Aller à une pièce…</option>${Object.keys(parNiveau).sort((a, b) => a - b).map((n) =>
        `<optgroup label="${esc(NIVEAUX[n] || `Niveau ${n}`)}">${parNiveau[n].map(([i, p]) => `<option value="${i}">${esc(p.libelle)}</option>`).join('')}</optgroup>`).join('')}</select>
      <button class="visite-rue">↺ Revenir dans la rue</button>
      <button class="visite-entrees">🏠 Vue d'ensemble</button>
      <small class="visite-aide">Guidez le personnage avec le joystick (ou flèches / ZQSD) · glissez pour tourner la caméra · boutons à droite (ou touche C) pour changer d'angle</small>
      </div>`;
    this.sceneEl.appendChild(panneau); this.panneau = panneau;
    panneau.querySelector('.visite-choix-piece').addEventListener('change', (ev) => { if (ev.target.value !== '') this.aller(+ev.target.value); ev.target.value = ''; });
    panneau.querySelector('.visite-choix-entree').addEventListener('change', (ev) => { if (ev.target.value !== '') this.entrer(+ev.target.value); ev.target.value = ''; });
    panneau.querySelector('.visite-sortir').addEventListener('click', () => this.desactiver());
    panneau.querySelector('.visite-entrees').addEventListener('click', () => this.dehors());
    panneau.querySelector('.visite-rue').addEventListener('click', () => this.demarrer());
    const menu = panneau.querySelector('.visite-menu'), bMenu = panneau.querySelector('.visite-menu-btn');
    bMenu.addEventListener('click', () => { menu.hidden = !menu.hidden; bMenu.setAttribute('aria-expanded', String(!menu.hidden)); });
    panneau.addEventListener('change', () => { menu.hidden = true; });
    // barre des caméras, toujours visible à droite de l'écran
    const cams = document.createElement('div'); cams.className = 'visite-cameras'; cams.hidden = true;
    cams.innerHTML = CAMERAS.map(([id, nom], i) => `<button data-c="${i}" class="${i === this.cam ? 'actif' : ''}" aria-label="Caméra ${nom}"><span>${ICONES[id]}</span>${nom.split(' ')[0]}</button>`).join('');
    cams.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-c]'); if (b) this.changerCamera(+b.dataset.c); });
    this.sceneEl.appendChild(cams); this.cams = cams;
    if (!this.depart) panneau.querySelector('.visite-rue').hidden = true;
    const hud = document.createElement('div'); hud.className = 'visite-hud'; hud.hidden = true; this.sceneEl.appendChild(hud); this.hud = hud;

    // joystick virtuel (comme dans un jeu mobile)
    const pad = document.createElement('div'); pad.className = 'visite-joystick'; pad.hidden = true;
    pad.innerHTML = '<div class="visite-manette"></div>';
    this.sceneEl.appendChild(pad); this.pad = pad; this.joy = { x: 0, y: 0 };
    const manette = pad.firstChild; let id = null;
    const lire = (e) => {
      const r = pad.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      manette.style.transform = `translate(${dx}px, ${dy}px)`; this.joy = { x: dx / R, y: dy / R }; this.cible = null;
    };
    pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); lire(e); e.preventDefault(); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) lire(e); });
    const lacher = (e) => { if (e.pointerId !== id) return; id = null; this.joy = { x: 0, y: 0 }; manette.style.transform = ''; };
    ['pointerup', 'pointercancel'].forEach((t) => pad.addEventListener(t, lacher));

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
      if (e.type === 'keydown' && e.key.toLowerCase() === 'c') { this.changerCamera(); return; }
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
    this.sceneEl.classList.add('en-visite'); document.body.classList.add('visite-active');
    this.sceneEl.requestFullscreen?.().catch(() => {});
    if (this.depart) this.demarrer(); else this.dehors();
  }

  /** Départ « jeu vidéo » : le visiteur est dans la rue, face au portail, et entre à pied. */
  demarrer() {
    this.v.controls.enabled = false; this.calque.hidden = true; this._lumiere(true);
    this._placer(this.depart, 0, -0.05);
  }

  /** Vue extérieure avec les pastilles d'entrée. */
  dehors() {
    this._lumiere(false); this.interieur = false; this.pad.hidden = true; this.hud.hidden = true; this.cams.hidden = true; this.calque.hidden = false;
    if (this.perso) this.perso.visible = false;
    this.v.controls.enabled = true; this.v.cadrer();
  }

  desactiver() {
    this.dehors(); this.actif = false; this.calque.hidden = true; this.panneau.hidden = true;
    this.v.surBoucle = null; this.sceneEl.classList.remove('en-visite'); document.body.classList.remove('visite-active');
    if (document.fullscreenElement === this.sceneEl) document.exitFullscreen?.().catch(() => {});
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
    this.interieur = true; this.pad.hidden = false; this.hud.hidden = false; this.cams.hidden = false; this.cible = null;
    this.yaw = yaw; this.pitch = pitch; this.cap = yaw;
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
      this.plafonniers?.forEach((l) => { v.scene.remove(l); l.dispose?.(); }); this.plafonniers = null;
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
    if (Math.hypot(this.joy.x, this.joy.y) > 0.15) { m.addScaledVector(avant, -this.joy.y).addScaledVector(cote, this.joy.x); this._course = Math.min(1.6, Math.hypot(this.joy.x, this.joy.y) * 1.6); } else this._course = 1;
    if (this.cible && m.lengthSq() === 0) {
      const d = this.cible.clone().sub(this.pieds); d.y = 0;
      if (d.length() < 0.15) this.cible = null;
      else {
        m = d.normalize();
        const viser = Math.atan2(-m.x, -m.z); let dy = viser - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 4);
      }
    }
    if (m.lengthSq() > 0) {
      m.normalize(); const pas = VITESSE * (this._course || 1) * dt;
      // essai direct, puis glissement le long de l'obstacle (comme dans un jeu vidéo)
      const essais = [m, new THREE.Vector3(m.x, 0, 0), new THREE.Vector3(0, 0, m.z),
        m.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7), m.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.7)];
      let bouge = false;
      for (const d of essais) {
        if (d.lengthSq() < 0.04) continue;
        const u = d.clone().normalize(), l = pas * (d === m ? 1 : Math.max(0.5, d.length()));
        if (this._bloque(this.pieds, u, l)) continue;
        const essai = this.pieds.clone().addScaledVector(u, l);
        const s = this._sol(essai);
        if (s !== null && s - this.pieds.y <= MARCHE_MAX) { this.pieds.x = essai.x; this.pieds.z = essai.z; bouge = true; break; }
      }
      if (!bouge) this.cible = null;
      if (bouge) {
        let dc = Math.atan2(-m.x, -m.z) - this.cap; dc = Math.atan2(Math.sin(dc), Math.cos(dc)); this.cap += dc * Math.min(1, dt * 10);
        this.pasPhase += dt * 9 * (this._course || 1);
      }
    } else this.pasPhase *= 0.8;
    // suivre le sol (descente douce, jamais dans le vide)
    const s = this._sol(this.pieds);
    if (s !== null) this.pieds.y += (s - this.pieds.y) * Math.min(1, dt * 12);
    this._appliquer();
    this._t = (this._t || 0) + dt; if (this._t > 0.4) { this._t = 0; this._ambiance(); }
  }

  /** Indique la pièce où se trouve le visiteur et allume les plafonniers des pièces proches. */
  _ambiance() {
    const oeil = this.pieds.clone().add(new THREE.Vector3(0, YEUX, 0));
    const proches = this.pieces.map((p) => ({ p, d: Math.hypot(p.pos.x - oeil.x, p.pos.z - oeil.z) + Math.abs(p.pos.y - oeil.y) * 3 })).sort((a, b) => a.d - b.d);
    const ici = proches[0];
    this.hud.textContent = ici && ici.d < 6 ? `📍 ${ici.p.libelle} · ${NIVEAUX[ici.p.niveau] || ''}` : '📍 Extérieur';
    if (!this.plafonniers) {
      this.plafonniers = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffe9cc', 9, 9, 1.5); this.v.scene.add(l); return l; });
    }
    this.plafonniers.forEach((l, i) => { const q = proches[i]; l.visible = !!q && q.d < 9; if (q) l.position.set(q.p.pos.x, q.p.pos.y + 1.0, q.p.pos.z); });
  }

  _appliquer() {
    const c = this.v.camera; c.rotation.order = 'YXZ';
    const [mode, , D0, elev0] = CAMERAS[this.cam];
    const perso = this._avatar(); perso.visible = mode !== 'subjectif' && this.interieur;
    if (c.near !== 0.1 && mode !== 'dessus') { c.near = 0.1; c.updateProjectionMatrix(); }
    if (mode === 'subjectif') {
      c.position.set(this.pieds.x, this.pieds.y + YEUX, this.pieds.z);
      c.rotation.set(-this.pitch, this.yaw, 0); return;
    }
    perso.position.copy(this.pieds); perso.rotation.y = this.cap;
    const balance = Math.sin(this.pasPhase) * 0.6;
    perso.userData.jambes.forEach((j, i) => { j.rotation.x = i ? balance : -balance; });
    perso.userData.bras.forEach((b, i) => { b.rotation.x = i ? -balance * 0.8 : balance * 0.8; });
    // caméra derrière l'épaule, rapprochée si un mur ou un plafond est entre elle et le personnage
    const tete = this.pieds.clone().add(new THREE.Vector3(0, 1.55, 0));
    const elev = THREE.MathUtils.clamp(elev0 + this.pitch, -0.2, 1.52);
    const az = this.yaw + (mode === 'face' ? Math.PI : 0);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    let D = D0 * (this.v.camera.aspect < 1 ? 1.7 : 1);   // téléphone en portrait : caméra plus reculée
    if (mode === 'dessus') {
      // vue en plan : les plafonds plus proches que le personnage sont coupés (maison de poupée)
      c.near = Math.max(0.1, D - 1.0); c.updateProjectionMatrix();
      c.position.copy(tete).addScaledVector(dir, D); c.lookAt(tete); return;
    }
    const proches = this.obstacles.filter(({ s }) => s.center.distanceTo(tete) < s.radius + D + 1).map(({ o }) => o);
    this.ray.set(tete, dir); this.ray.far = D;
    const h = this.ray.intersectObjects(proches, false)[0];
    if (h) D = Math.max(0.35, h.distance - 0.25);
    c.position.copy(tete).addScaledVector(dir, D);
    c.lookAt(tete);
  }

  /** Passe à la caméra suivante (bouton 🎥 ou touche C). */
  changerCamera(i) {
    this.cam = i ?? (this.cam + 1) % CAMERAS.length; this.pitch = 0;
    this.cams.querySelectorAll('button').forEach((b) => b.classList.toggle('actif', +b.dataset.c === this.cam));
    this._appliquer();
  }

  /** Personnage du visiteur (aux couleurs de KKG for Innovation). */
  _avatar() {
    if (this.perso) return this.perso;
    const m = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const peau = m('#6b4227'), chemise = m('#d4a75c', 0.5), pantalon = m('#1d2430'), cheveux = m('#141414', 0.9);
    const g = new THREE.Group(); g.name = 'visiteur';
    const corps = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 12), chemise); corps.position.y = 1.18; g.add(corps);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), peau); tete.position.y = 1.62; g.add(tete);
    const coiffe = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), cheveux); coiffe.position.y = 1.64; g.add(coiffe);
    const membre = (x, y, r, l, mat) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const os = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), mat); os.position.y = -l / 2 - r; pivot.add(os); g.add(pivot); return pivot; };
    g.userData.jambes = [membre(-0.1, 0.86, 0.075, 0.62, pantalon), membre(0.1, 0.86, 0.075, 0.62, pantalon)];
    g.userData.bras = [membre(-0.27, 1.42, 0.06, 0.45, chemise), membre(0.27, 1.42, 0.06, 0.45, chemise)];
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.v.scene.add(g); this.perso = g; return g;
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
