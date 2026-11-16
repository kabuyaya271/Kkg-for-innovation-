// Éditeur de plan 2D (SVG) : dessin de murs, ouvertures, pièces, cotes, textes.
import {
  uid, longueur, projeterSurSegment, aire, centroide, pointDansPolygone, boite,
  ouverturesDuMur, ouvertureValide, fmt, arrondi,
} from './modele.js';

const NS = 'http://www.w3.org/2000/svg';
const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (v) => Math.round(v * 1000) / 1000;

export const OUTILS = {
  select: { nom: 'Sélection', touche: 'V', aide: 'Cliquez un élément pour le modifier. Glissez les poignées pour le déformer.' },
  mur: { nom: 'Mur', touche: 'M', aide: 'Cliquez les points successifs. Tapez une longueur puis Entrée pour une cote exacte. Échap ou double-clic pour finir.' },
  rect: { nom: 'Rectangle de murs', touche: 'R', aide: 'Glissez pour tracer 4 murs (pièce ou enveloppe). Tapez « L×l » puis Entrée après le premier clic pour des dimensions exactes.' },
  porte: { nom: 'Porte', touche: 'P', aide: 'Cliquez sur un mur pour placer une porte.' },
  fenetre: { nom: 'Fenêtre', touche: 'F', aide: 'Cliquez sur un mur pour placer une fenêtre.' },
  baie: { nom: 'Baie vitrée', touche: 'B', aide: 'Cliquez sur un mur pour placer une baie.' },
  piece: { nom: 'Pièce', touche: 'A', aide: 'Cliquez les sommets de la pièce (accrochage aux murs). Cliquez le premier point ou Entrée pour fermer.' },
  cote: { nom: 'Cote', touche: 'C', aide: 'Cliquez deux points pour coter une distance.' },
  texte: { nom: 'Texte', touche: 'T', aide: 'Cliquez pour placer une annotation.' },
  effacer: { nom: 'Effacer', touche: 'E', aide: 'Cliquez un élément pour le supprimer.' },
  main: { nom: 'Déplacer la vue', touche: 'H', aide: 'Glissez pour déplacer la vue (ou bouton du milieu / Espace + glisser).' },
};

export class Editeur {
  constructor(svg, options) {
    this.svg = svg;
    this.o = options; // { niveau(), niveauDessous(), etude(), commit(fn), changement(), selection(sel), statut(txt), nom(defaut) }
    this.outil = 'select';
    this.ortho = true;
    this.aimant = true;
    this.pas = 0.05;
    this.vue = { s: 40, ox: 80, oy: 80 };
    this.sel = null;
    this.chaine = [];       // points en cours de dessin
    this.curseur = null;    // dernière position (modèle, accrochée)
    this.accroche = null;   // point d'accrochage affiché
    this.saisie = '';       // longueur tapée au clavier
    this.glisse = null;     // opération de glissement en cours
    this.espace = false;
    this.defauts = {
      epaisseur: 0.2, exterieur: true,
      porte: { largeur: 0.9, hauteur: 2.1, allege: 0 },
      fenetre: { largeur: 1.2, hauteur: 1.2, allege: 1.0 },
      baie: { largeur: 2.4, hauteur: 2.2, allege: 0 },
    };
    this.calque = null; // { src, largeur (m), opacite }

    svg.innerHTML = `<defs>
      <pattern id="hachure" width="0.25" height="0.25" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.25" stroke="#8a8378" stroke-width="0.04"/></pattern>
    </defs><g id="monde"></g><g id="ecran"></g>`;
    this.monde = svg.querySelector('#monde');
    this.ecran = svg.querySelector('#ecran');

    svg.addEventListener('pointerdown', (ev) => this.pointerDown(ev));
    svg.addEventListener('pointermove', (ev) => this.pointerMove(ev));
    svg.addEventListener('pointerup', (ev) => this.pointerUp(ev));
    svg.addEventListener('dblclick', (ev) => { ev.preventDefault(); this.terminer(); });
    svg.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (this.chaine.length) this.terminer(); });
    svg.addEventListener('wheel', (ev) => this.molette(ev), { passive: false });
    new ResizeObserver(() => this.rendre()).observe(svg);
  }

  // ---------------- Coordonnées ----------------
  versModele(ev) {
    const r = this.svg.getBoundingClientRect();
    return { x: (ev.clientX - r.left - this.vue.ox) / this.vue.s, y: (ev.clientY - r.top - this.vue.oy) / this.vue.s };
  }
  get tol() { return 9 / this.vue.s; }

  molette(ev) {
    ev.preventDefault();
    const r = this.svg.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const k = Math.exp(-ev.deltaY * 0.0015);
    const s = Math.min(600, Math.max(3, this.vue.s * k));
    this.vue.ox = mx - ((mx - this.vue.ox) * s) / this.vue.s;
    this.vue.oy = my - ((my - this.vue.oy) * s) / this.vue.s;
    this.vue.s = s;
    this.rendre();
  }

  cadrer() {
    const n = this.o.niveau();
    const b = boite(n) || (this.o.niveauDessous() && boite(this.o.niveauDessous()));
    const W = this.svg.clientWidth || 800, H = this.svg.clientHeight || 600;
    if (!b) { this.vue = { s: 40, ox: 60, oy: 60 }; this.rendre(); return; }
    const s = Math.min((W - 120) / Math.max(b.w, 1), (H - 120) / Math.max(b.h, 1));
    this.vue = { s, ox: (W - b.w * s) / 2 - b.x * s, oy: (H - b.h * s) / 2 - b.y * s };
    this.rendre();
  }

  // ---------------- Accrochage ----------------
  pointsAccrochage() {
    const n = this.o.niveau();
    const pts = [];
    for (const m of n.murs) pts.push({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
    for (const p of n.pieces) pts.push(...p.points);
    const d = this.o.niveauDessous();
    if (d) for (const m of d.murs) pts.push({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
    return pts;
  }

  accrocher(p, depuis = null, { surMurs = false } = {}) {
    this.accroche = null;
    let best = null, bd = this.tol * 1.4;
    for (const q of this.pointsAccrochage()) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) { this.accroche = { ...best, type: 'extrémité' }; return { x: best.x, y: best.y }; }
    let r = { ...p };
    if (depuis && this.ortho) {
      if (Math.abs(r.x - depuis.x) > Math.abs(r.y - depuis.y)) r.y = depuis.y; else r.x = depuis.x;
    }
    if (surMurs) {
      for (const m of this.o.niveau().murs) {
        const pr = projeterSurSegment(r.x, r.y, m);
        if (pr.d < this.tol) { this.accroche = { x: pr.x, y: pr.y, type: 'sur mur' }; return { x: pr.x, y: pr.y }; }
      }
    }
    if (this.aimant) {
      if (depuis && this.ortho) {
        if (r.y === depuis.y) r.x = depuis.x + arrondi(r.x - depuis.x, this.pas);
        else r.y = depuis.y + arrondi(r.y - depuis.y, this.pas);
      } else { r.x = arrondi(r.x, this.pas); r.y = arrondi(r.y, this.pas); }
    }
    r = { x: n2(r.x), y: n2(r.y) };
    return r;
  }

  // ---------------- Détection ----------------
  toucher(p) {
    const n = this.o.niveau();
    const t = this.tol;
    for (const o of n.ouvertures) {
      const m = n.murs.find((w) => w.id === o.murId); if (!m) continue;
      const pr = projeterSurSegment(p.x, p.y, m);
      if (pr.d < m.epaisseur / 2 + t && Math.abs(pr.dist - o.position) < o.largeur / 2) return { type: 'ouverture', id: o.id };
    }
    for (const m of n.murs) if (projeterSurSegment(p.x, p.y, m).d < m.epaisseur / 2 + t * 0.5) return { type: 'mur', id: m.id };
    for (const c of n.cotes) {
      const g = this.geomCote(c);
      if (projeterSurSegment(p.x, p.y, { x1: g.a.x, y1: g.a.y, x2: g.b.x, y2: g.b.y }).d < t) return { type: 'cote', id: c.id };
    }
    for (const x of n.textes) if (Math.hypot(p.x - x.x, p.y - x.y) < Math.max(t * 2, x.taille)) return { type: 'texte', id: x.id };
    for (const r of n.pieces) if (pointDansPolygone(p.x, p.y, r.points)) return { type: 'piece', id: r.id };
    return null;
  }

  element(sel = this.sel) {
    if (!sel) return null;
    const n = this.o.niveau();
    const liste = { mur: n.murs, ouverture: n.ouvertures, piece: n.pieces, cote: n.cotes, texte: n.textes }[sel.type];
    return liste?.find((x) => x.id === sel.id) || null;
  }

  selectionner(sel) { this.sel = sel && this.element(sel) ? sel : null; this.o.selection(this.sel); this.rendre(); }

  supprimer(sel = this.sel) {
    if (!sel) return;
    this.o.commit(() => {
      const n = this.o.niveau();
      const cle = { mur: 'murs', ouverture: 'ouvertures', piece: 'pieces', cote: 'cotes', texte: 'textes' }[sel.type];
      n[cle] = n[cle].filter((x) => x.id !== sel.id);
      if (sel.type === 'mur') n.ouvertures = n.ouvertures.filter((o) => o.murId !== sel.id);
    });
    if (this.sel?.id === sel.id) this.selectionner(null);
  }

  // ---------------- Outils ----------------
  setOutil(outil) {
    this.outil = outil;
    this.chaine = []; this.saisie = ''; this.glisse = null;
    this.svg.dataset.outil = outil;
    this.statut();
    this.rendre();
  }

  statut(extra = '') {
    const o = OUTILS[this.outil];
    const pos = this.curseur ? `x ${fmt(this.curseur.x)}  y ${fmt(this.curseur.y)}` : '';
    let mesure = '';
    if (this.chaine.length && this.curseur) {
      const a = this.chaine[this.chaine.length - 1];
      const L = Math.hypot(this.curseur.x - a.x, this.curseur.y - a.y);
      const ang = (Math.atan2(-(this.curseur.y - a.y), this.curseur.x - a.x) * 180) / Math.PI;
      mesure = this.outil === 'rect'
        ? `${fmt(Math.abs(this.curseur.x - a.x))} × ${fmt(Math.abs(this.curseur.y - a.y))} m`
        : `L ${fmt(L)} m  ∠ ${fmt((ang + 360) % 360, 1)}°`;
    }
    this.o.statut({
      outil: o.nom, aide: o.aide, pos, mesure,
      saisie: this.saisie, accroche: this.accroche?.type || '', extra,
    });
  }

  pointerDown(ev) {
    this.svg.setPointerCapture(ev.pointerId);
    const brut = this.versModele(ev);
    if (ev.button === 1 || this.outil === 'main' || this.espace || (ev.button === 2 && !this.chaine.length)) {
      this.glisse = { type: 'pan', x: ev.clientX, y: ev.clientY, ox: this.vue.ox, oy: this.vue.oy };
      return;
    }
    if (ev.button !== 0) return;
    const n = this.o.niveau();

    switch (this.outil) {
      case 'select': {
        const poignee = this.poigneeTouchee(brut);
        if (poignee) { this.glisse = { type: 'poignee', ...poignee, debut: true }; return; }
        this.selectionner(this.toucher(brut));
        if (this.sel?.type === 'texte') this.glisse = { type: 'texte', id: this.sel.id, debut: true };
        if (this.sel?.type === 'ouverture') this.glisse = { type: 'ouverture', id: this.sel.id, debut: true };
        return;
      }
      case 'effacer': { const t = this.toucher(brut); if (t) this.supprimer(t); return; }
      case 'mur': {
        const p = this.accrocher(brut, this.chaine[this.chaine.length - 1]);
        if (this.chaine.length && this.chaine[0] !== p && Math.hypot(p.x - this.chaine[0].x, p.y - this.chaine[0].y) < 1e-6 && this.chaine.length > 1) {
          this.ajouterMur(this.chaine[this.chaine.length - 1], p); this.terminer(); return;
        }
        if (this.chaine.length) this.ajouterMur(this.chaine[this.chaine.length - 1], p);
        this.chaine.push(p);
        this.saisie = '';
        break;
      }
      case 'rect': {
        if (this.chaine.length) { this.ajouterRectangle(this.chaine[0], this.accrocher(brut)); this.chaine = []; break; }
        this.chaine = [this.accrocher(brut)];
        this.glisse = { type: 'rect' };
        break;
      }
      case 'porte': case 'fenetre': case 'baie': {
        let meilleur = null;
        for (const m of n.murs) { const pr = projeterSurSegment(brut.x, brut.y, m); if (pr.d < m.epaisseur / 2 + this.tol && (!meilleur || pr.d < meilleur.pr.d)) meilleur = { m, pr }; }
        if (!meilleur) { this.statut('Cliquez sur un mur.'); return; }
        const d = this.defauts[this.outil];
        const L = longueur(meilleur.m);
        const position = Math.min(Math.max(arrondi(meilleur.pr.dist, 0.05), d.largeur / 2 + 0.05), L - d.largeur / 2 - 0.05);
        if (!ouvertureValide(n, meilleur.m, position, d.largeur)) { this.statut('Pas assez de place sur ce mur à cet endroit.'); return; }
        const id = uid();
        this.o.commit(() => n.ouvertures.push({ id, murId: meilleur.m.id, type: this.outil, position, ...d }));
        this.selectionner({ type: 'ouverture', id });
        return;
      }
      case 'piece': {
        const p = this.accrocher(brut, null, { surMurs: true });
        if (this.chaine.length >= 3 && Math.hypot(p.x - this.chaine[0].x, p.y - this.chaine[0].y) < this.tol * 1.5) { this.terminer(); return; }
        this.chaine.push(p);
        break;
      }
      case 'cote': {
        const p = this.accrocher(brut, this.chaine[0], { surMurs: true });
        this.chaine.push(p);
        if (this.chaine.length === 2) {
          const [a, b] = this.chaine;
          if (Math.hypot(b.x - a.x, b.y - a.y) > 0.01) this.o.commit(() => n.cotes.push({ id: uid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, decalage: 0.6 }));
          this.chaine = [];
        }
        break;
      }
      case 'texte': {
        const p = this.accrocher(brut);
        const txt = prompt('Texte de l\'annotation :');
        if (txt) this.o.commit(() => n.textes.push({ id: uid(), x: p.x, y: p.y, texte: txt.slice(0, 200), taille: 0.3 }));
        return;
      }
      default:
    }
    this.rendre();
  }

  pointerMove(ev) {
    const brut = this.versModele(ev);
    const g = this.glisse;
    if (g?.type === 'pan') {
      this.vue.ox = g.ox + ev.clientX - g.x; this.vue.oy = g.oy + ev.clientY - g.y; this.rendre(); return;
    }
    const n = this.o.niveau();
    if (g?.type === 'poignee') {
      const p = this.accrocher(brut);
      if (g.debut) { this.o.commit(() => {}); g.debut = false; }
      if (g.cible === 'mur') {
        for (const m of n.murs) {
          if (Math.hypot(m.x1 - g.x, m.y1 - g.y) < 0.005) { m.x1 = p.x; m.y1 = p.y; }
          if (Math.hypot(m.x2 - g.x, m.y2 - g.y) < 0.005) { m.x2 = p.x; m.y2 = p.y; }
        }
        g.x = p.x; g.y = p.y;
      } else if (g.cible === 'piece') {
        const r = n.pieces.find((x) => x.id === g.id); r.points[g.i] = p;
      }
      this.curseur = p; this.o.changement(false); this.rendre(); this.statut(); return;
    }
    if (g?.type === 'texte') {
      const p = this.accrocher(brut);
      if (g.debut) { this.o.commit(() => {}); g.debut = false; }
      const t = n.textes.find((x) => x.id === g.id); t.x = p.x; t.y = p.y;
      this.o.changement(false); this.rendre(); return;
    }
    if (g?.type === 'ouverture' && ev.buttons) {
      const o = n.ouvertures.find((x) => x.id === g.id); const m = n.murs.find((w) => w.id === o.murId);
      const pr = projeterSurSegment(brut.x, brut.y, m);
      const pos = arrondi(pr.dist, 0.05);
      if (pos !== o.position && ouvertureValide(n, m, pos, o.largeur, o.id)) {
        if (g.debut) { this.o.commit(() => {}); g.debut = false; }
        o.position = pos; this.o.changement(false); this.o.selection(this.sel); this.rendre();
      }
      return;
    }
    const depuis = ['mur', 'cote'].includes(this.outil) ? this.chaine[this.chaine.length - 1] : null;
    this.curseur = this.outil === 'select' || this.outil === 'main' ? { x: n2(brut.x), y: n2(brut.y) }
      : this.accrocher(brut, depuis, { surMurs: ['piece', 'cote'].includes(this.outil) });
    this.rendreApercu();
    this.statut();
  }

  pointerUp() {
    const g = this.glisse;
    this.glisse = null;
    if (g?.type === 'rect' && this.chaine.length && this.curseur) {
      const a = this.chaine[0], c = this.curseur;
      if (Math.abs(c.x - a.x) >= 0.3 && Math.abs(c.y - a.y) >= 0.3) { this.ajouterRectangle(a, c); this.chaine = []; this.rendre(); }
    }
    if (g && ['poignee', 'texte', 'ouverture'].includes(g.type) && !g.debut) this.o.changement(true);
  }

  poigneeTouchee(p) {
    const el = this.element();
    if (!el) return null;
    const t = this.tol * 1.2;
    if (this.sel.type === 'mur') {
      if (Math.hypot(p.x - el.x1, p.y - el.y1) < t) return { cible: 'mur', x: el.x1, y: el.y1 };
      if (Math.hypot(p.x - el.x2, p.y - el.y2) < t) return { cible: 'mur', x: el.x2, y: el.y2 };
    }
    if (this.sel.type === 'piece') {
      const i = el.points.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < t);
      if (i >= 0) return { cible: 'piece', id: el.id, i };
    }
    return null;
  }

  ajouterMur(a, b) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.02) return;
    const n = this.o.niveau();
    this.o.commit(() => n.murs.push({ id: uid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, epaisseur: this.defauts.epaisseur, exterieur: this.defauts.exterieur }));
  }

  ajouterRectangle(a, b) {
    if (Math.abs(b.x - a.x) < 0.3 || Math.abs(b.y - a.y) < 0.3) return;
    const n = this.o.niveau();
    const P = [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }];
    this.o.commit(() => {
      for (let i = 0; i < 4; i++) {
        const p = P[i], q = P[(i + 1) % 4];
        n.murs.push({ id: uid(), x1: p.x, y1: p.y, x2: q.x, y2: q.y, epaisseur: this.defauts.epaisseur, exterieur: this.defauts.exterieur });
      }
    });
  }

  terminer() {
    if (this.outil === 'piece' && this.chaine.length >= 3) {
      const n = this.o.niveau();
      const pts = this.chaine.map((p) => ({ x: p.x, y: p.y }));
      const nom = this.o.nom(`Pièce ${n.pieces.length + 1}`);
      if (nom !== null) {
        const id = uid();
        this.o.commit(() => n.pieces.push({ id, nom: nom || `Pièce ${n.pieces.length + 1}`, points: pts }));
        this.chaine = []; this.selectionner({ type: 'piece', id }); return;
      }
    }
    this.chaine = []; this.saisie = '';
    this.rendre(); this.statut();
  }

  /** Clavier : longueur tapée, Entrée, Échap. Retourne true si la touche est consommée. */
  touche(ev) {
    if (['mur', 'rect', 'cote'].includes(this.outil) && this.chaine.length) {
      if (/^[\d.,x×*]$/i.test(ev.key)) { this.saisie += ev.key.replace(',', '.').replace(/[x×*]/i, 'x'); this.statut(); return true; }
      if (ev.key === 'Backspace' && this.saisie) { this.saisie = this.saisie.slice(0, -1); this.statut(); return true; }
      if (ev.key === 'Enter' && this.saisie) { this.appliquerSaisie(); return true; }
    }
    if (ev.key === 'Enter') { this.terminer(); return true; }
    if (ev.key === 'Escape') {
      if (this.chaine.length || this.saisie) { this.chaine = []; this.saisie = ''; this.rendre(); this.statut(); } else this.selectionner(null);
      return true;
    }
    return false;
  }

  appliquerSaisie() {
    const a = this.chaine[this.chaine.length - 1];
    const c = this.curseur || { x: a.x + 1, y: a.y };
    if (this.outil === 'rect') {
      const [L, l] = this.saisie.split('x').map(Number);
      if (L > 0 && l > 0) {
        const sx = Math.sign(c.x - a.x) || 1, sy = Math.sign(c.y - a.y) || 1;
        this.ajouterRectangle(a, { x: n2(a.x + sx * L), y: n2(a.y + sy * l) });
        this.chaine = []; this.glisse = null;
      }
    } else {
      const L = Number(this.saisie);
      if (L > 0) {
        let dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const b = { x: n2(a.x + dx * L), y: n2(a.y + dy * L) };
        if (this.outil === 'mur') { this.ajouterMur(a, b); this.chaine.push(b); } else {
          this.o.commit(() => this.o.niveau().cotes.push({ id: uid(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, decalage: 0.6 }));
          this.chaine = [];
        }
      }
    }
    this.saisie = '';
    this.rendre(); this.statut();
  }

  // ---------------- Rendu ----------------
  geomCote(c) {
    const dx = c.x2 - c.x1, dy = c.y2 - c.y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const a = { x: c.x1 + nx * c.decalage, y: c.y1 + ny * c.decalage }, b = { x: c.x2 + nx * c.decalage, y: c.y2 + ny * c.decalage };
    return { a, b, L, nx, ny, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
  }

  svgMur(n, m, { fantome = false } = {}) {
    const L = longueur(m); if (L < 1e-6) return '';
    const ux = (m.x2 - m.x1) / L, uy = (m.y2 - m.y1) / L, nx = -uy, ny = ux, h = m.epaisseur / 2;
    const P = (s, k) => `${n2(m.x1 + ux * s + nx * h * k)},${n2(m.y1 + uy * s + ny * h * k)}`;
    const ouv = fantome ? [] : ouverturesDuMur(n, m);
    const segs = []; let debut = -h;
    for (const o of ouv) { segs.push([debut, o.a]); debut = o.b; }
    segs.push([debut, L + h]);
    const fill = fantome ? 'none' : m.exterieur ? '#4b4f57' : '#7a7f88';
    const attrs = fantome ? 'fill="none" stroke="#9aa3b5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" stroke-width="1"' : `fill="${fill}"`;
    let s = segs.filter(([a, b]) => b - a > 0.001).map(([a, b]) => `<polygon points="${P(a, 1)} ${P(b, 1)} ${P(b, -1)} ${P(a, -1)}" ${attrs}/>`).join('');
    if (!fantome) {
      for (const o of ouv) {
        if (o.type === 'porte') {
          const hx = m.x1 + ux * o.a + nx * h, hy = m.y1 + uy * o.a + ny * h;
          const fx = hx + nx * o.largeur, fy = hy + ny * o.largeur;
          const ex = m.x1 + ux * o.b + nx * h, ey = m.y1 + uy * o.b + ny * h;
          s += `<line x1="${n2(hx)}" y1="${n2(hy)}" x2="${n2(fx)}" y2="${n2(fy)}" class="sym"/><path d="M ${n2(fx)} ${n2(fy)} A ${o.largeur} ${o.largeur} 0 0 ${ux * ny - uy * nx > 0 ? 0 : 1} ${n2(ex)} ${n2(ey)}" class="sym arc"/>`;
        } else {
          s += `<polygon points="${P(o.a, 1)} ${P(o.b, 1)} ${P(o.b, -1)} ${P(o.a, -1)}" class="vitrage"/>`;
          s += `<line x1="${n2(m.x1 + ux * o.a)}" y1="${n2(m.y1 + uy * o.a)}" x2="${n2(m.x1 + ux * o.b)}" y2="${n2(m.y1 + uy * o.b)}" class="sym"/>`;
          if (o.type === 'baie') { const mid = (o.a + o.b) / 2; s += `<line x1="${P(mid, 1).split(',')[0]}" y1="${P(mid, 1).split(',')[1]}" x2="${P(mid, -1).split(',')[0]}" y2="${P(mid, -1).split(',')[1]}" class="sym"/>`; }
        }
      }
    }
    return s;
  }

  svgCote(c, classe = 'cote') {
    const g = this.geomCote(c);
    const t = 0.12;
    const sens = Math.sign(c.decalage || 1);
    const mx = (g.a.x + g.b.x) / 2 + g.nx * 0.2 * sens, my = (g.a.y + g.b.y) / 2 + g.ny * 0.2 * sens;
    let ang = g.ang; if (ang > 90 || ang < -90) ang += 180;
    return `<g class="${classe}"><line x1="${c.x1}" y1="${c.y1}" x2="${n2(g.a.x)}" y2="${n2(g.a.y)}" class="rappel"/><line x1="${c.x2}" y1="${c.y2}" x2="${n2(g.b.x)}" y2="${n2(g.b.y)}" class="rappel"/>
      <line x1="${n2(g.a.x)}" y1="${n2(g.a.y)}" x2="${n2(g.b.x)}" y2="${n2(g.b.y)}"/>
      <line x1="${n2(g.a.x - t)}" y1="${n2(g.a.y + t)}" x2="${n2(g.a.x + t)}" y2="${n2(g.a.y - t)}"/><line x1="${n2(g.b.x - t)}" y1="${n2(g.b.y + t)}" x2="${n2(g.b.x + t)}" y2="${n2(g.b.y - t)}"/>
      <text x="${n2(mx)}" y="${n2(my)}" transform="rotate(${n2(ang)} ${n2(mx)} ${n2(my)})" text-anchor="middle" dominant-baseline="central" font-size="0.22">${fmt(g.L)}</text></g>`;
  }

  grille() {
    const W = this.svg.clientWidth, H = this.svg.clientHeight, { s, ox, oy } = this.vue;
    const x0 = -ox / s, y0 = -oy / s, x1 = (W - ox) / s, y1 = (H - oy) / s;
    let pas = 1; while (pas * s < 12) pas *= 5; const fin = pas * s > 60 ? pas / 5 : null;
    let g = '';
    const lignes = (p, cls) => {
      for (let x = Math.ceil(x0 / p) * p; x <= x1; x += p) g += `<line x1="${n2(x)}" y1="${n2(y0)}" x2="${n2(x)}" y2="${n2(y1)}" class="${cls}"/>`;
      for (let y = Math.ceil(y0 / p) * p; y <= y1; y += p) g += `<line x1="${n2(x0)}" y1="${n2(y)}" x2="${n2(x1)}" y2="${n2(y)}" class="${cls}"/>`;
    };
    if (fin) lignes(fin, 'grille-fine');
    lignes(pas, 'grille');
    g += `<line x1="0" y1="${n2(y0)}" x2="0" y2="${n2(y1)}" class="axe"/><line x1="${n2(x0)}" y1="0" x2="${n2(x1)}" y2="0" class="axe"/>`;
    return g;
  }

  rendre() {
    const n = this.o.niveau();
    if (!this.svg.clientWidth || !n) return;
    const dessous = this.o.niveauDessous();
    const { s, ox, oy } = this.vue;
    let h = this.grille();
    if (this.calque?.src) {
      h += `<image href="${this.calque.src}" x="${this.calque.x || 0}" y="${this.calque.y || 0}" width="${this.calque.largeur}" opacity="${this.calque.opacite}" preserveAspectRatio="xMinYMin meet"/>`;
    }
    if (dessous) h += `<g class="fantome">${dessous.murs.map((m) => this.svgMur(dessous, m, { fantome: true })).join('')}</g>`;
    for (const r of n.pieces) {
      const sel = this.sel?.id === r.id;
      const c = centroide(r.points);
      h += `<polygon points="${r.points.map((q) => `${q.x},${q.y}`).join(' ')}" class="piece${sel ? ' sel' : ''}"/>`;
      h += `<text x="${n2(c.x)}" y="${n2(c.y)}" class="etiquette" text-anchor="middle" font-size="0.32">${e(r.nom)}</text><text x="${n2(c.x)}" y="${n2(c.y + 0.4)}" class="etiquette surf" text-anchor="middle" font-size="0.24">${fmt(aire(r.points))} m²</text>`;
    }
    for (const m of n.murs) h += `<g class="mur${this.sel?.id === m.id ? ' sel' : ''}">${this.svgMur(n, m)}</g>`;
    for (const c of n.cotes) h += this.svgCote(c, this.sel?.id === c.id ? 'cote sel' : 'cote');
    for (const t of n.textes) h += `<text x="${t.x}" y="${t.y}" font-size="${t.taille}" class="annotation${this.sel?.id === t.id ? ' sel' : ''}">${e(t.texte)}</text>`;
    // sélection
    const el = this.element();
    if (el && this.sel.type === 'mur') {
      h += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" class="contour-sel"/>`;
      h += this.svgCote({ x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2, decalage: el.epaisseur / 2 + 0.45 }, 'cote auto');
    }
    if (el && this.sel.type === 'ouverture') {
      const m = n.murs.find((w) => w.id === el.murId);
      if (m) {
        const L = longueur(m), ux = (m.x2 - m.x1) / L, uy = (m.y2 - m.y1) / L;
        const a = { x: m.x1 + ux * (el.position - el.largeur / 2), y: m.y1 + uy * (el.position - el.largeur / 2) };
        const b = { x: m.x1 + ux * (el.position + el.largeur / 2), y: m.y1 + uy * (el.position + el.largeur / 2) };
        h += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="contour-sel epais"/>`;
        h += this.svgCote({ x1: m.x1, y1: m.y1, x2: a.x, y2: a.y, decalage: -(m.epaisseur / 2 + 0.45) }, 'cote auto');
      }
    }
    this.monde.setAttribute('transform', `translate(${ox} ${oy}) scale(${s})`);
    this.monde.innerHTML = `${h}<g id="apercu"></g>`;
    this.rendreApercu();
  }

  rendreApercu() {
    const g = this.monde.querySelector('#apercu'); if (!g) return;
    const { s } = this.vue;
    let h = '';
    const c = this.curseur;
    if (c && this.chaine.length) {
      if (this.outil === 'mur') {
        const pts = [...this.chaine, c];
        h += `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" class="apercu-mur" stroke-width="${this.defauts.epaisseur}"/>`;
        const a = this.chaine[this.chaine.length - 1];
        h += this.svgCote({ x1: a.x, y1: a.y, x2: c.x, y2: c.y, decalage: 0.5 }, 'cote auto');
      } else if (this.outil === 'rect') {
        const a = this.chaine[0];
        h += `<rect x="${Math.min(a.x, c.x)}" y="${Math.min(a.y, c.y)}" width="${Math.abs(c.x - a.x)}" height="${Math.abs(c.y - a.y)}" class="apercu-rect" stroke-width="${this.defauts.epaisseur}"/>`;
        h += this.svgCote({ x1: Math.min(a.x, c.x), y1: Math.min(a.y, c.y), x2: Math.max(a.x, c.x), y2: Math.min(a.y, c.y), decalage: -0.6 }, 'cote auto');
        h += this.svgCote({ x1: Math.max(a.x, c.x), y1: Math.min(a.y, c.y), x2: Math.max(a.x, c.x), y2: Math.max(a.y, c.y), decalage: -0.6 }, 'cote auto');
      } else if (this.outil === 'piece') {
        const pts = [...this.chaine, c];
        h += `<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" class="apercu-piece"/>`;
        if (pts.length >= 3) h += `<text x="${centroide(pts).x}" y="${centroide(pts).y}" font-size="0.3" text-anchor="middle" class="etiquette">${fmt(aire(pts))} m²</text>`;
      } else if (this.outil === 'cote') {
        h += this.svgCote({ x1: this.chaine[0].x, y1: this.chaine[0].y, x2: c.x, y2: c.y, decalage: 0.6 }, 'cote auto');
      }
    }
    // poignées
    const el = this.element();
    const poignee = (x, y) => `<rect x="${x - 5 / s}" y="${y - 5 / s}" width="${10 / s}" height="${10 / s}" class="poignee"/>`;
    if (el && this.sel.type === 'mur') h += poignee(el.x1, el.y1) + poignee(el.x2, el.y2);
    if (el && this.sel.type === 'piece') h += el.points.map((q) => poignee(q.x, q.y)).join('');
    if (this.accroche && this.outil !== 'select') h += `<rect x="${this.accroche.x - 6 / s}" y="${this.accroche.y - 6 / s}" width="${12 / s}" height="${12 / s}" class="accroche"/>`;
    if (c && this.outil !== 'select' && this.outil !== 'main') {
      h += `<line x1="${c.x - 14 / s}" y1="${c.y}" x2="${c.x + 14 / s}" y2="${c.y}" class="viseur"/><line x1="${c.x}" y1="${c.y - 14 / s}" x2="${c.x}" y2="${c.y + 14 / s}" class="viseur"/>`;
    }
    g.innerHTML = h;
  }

  /** SVG autonome du niveau (export / impression). */
  exporterSVG({ marge = 1, largeurPx = 1600 } = {}) {
    const n = this.o.niveau();
    const b = boite(n) || { x: 0, y: 0, w: 10, h: 10 };
    const selAvant = this.sel; this.sel = null;
    const parties = [];
    for (const r of n.pieces) {
      const c = centroide(r.points);
      parties.push(`<polygon points="${r.points.map((q) => `${q.x},${q.y}`).join(' ')}" fill="#f4f1ea" stroke="none"/>`);
      parties.push(`<text x="${n2(c.x)}" y="${n2(c.y)}" text-anchor="middle" font-size="0.32" font-family="Arial">${e(r.nom)}</text><text x="${n2(c.x)}" y="${n2(c.y + 0.4)}" text-anchor="middle" font-size="0.24" font-family="Arial" fill="#555">${fmt(aire(r.points))} m²</text>`);
    }
    for (const m of n.murs) parties.push(this.svgMur(n, m).replace(/fill="#4b4f57"/g, 'fill="#222"').replace(/fill="#7a7f88"/g, 'fill="#666"'));
    for (const c of n.cotes) parties.push(this.svgCote(c));
    for (const t of n.textes) parties.push(`<text x="${t.x}" y="${t.y}" font-size="${t.taille}" font-family="Arial">${e(t.texte)}</text>`);
    this.sel = selAvant;
    const vb = `${n2(b.x - marge)} ${n2(b.y - marge)} ${n2(b.w + 2 * marge)} ${n2(b.h + 2 * marge)}`;
    const hauteurPx = Math.round((largeurPx * (b.h + 2 * marge)) / (b.w + 2 * marge));
    return `<svg xmlns="${NS}" viewBox="${vb}" width="${largeurPx}" height="${hauteurPx}">
<style>.sym{stroke:#222;stroke-width:0.02;fill:none}.arc{stroke-dasharray:0.06 0.04}.vitrage{fill:#cfe3ef;stroke:#222;stroke-width:0.015}
.cote line{stroke:#b05a2a;stroke-width:0.015}.cote text{fill:#b05a2a;font-family:Arial}.rappel{stroke-dasharray:0.05 0.05}</style>
<rect x="${n2(b.x - marge)}" y="${n2(b.y - marge)}" width="${n2(b.w + 2 * marge)}" height="${n2(b.h + 2 * marge)}" fill="#fff"/>
${parties.join('\n')}</svg>`;
  }
}
