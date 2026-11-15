// Modèle de données de l'atelier : étude → niveaux → murs, ouvertures, pièces, cotes, textes.
// Unités : mètres. Plan : x vers la droite, y vers le bas.

export const uid = () => Math.random().toString(36).slice(2, 10);
export const arrondi = (v, p = 0.01) => Math.round(v / p) * p;
export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');

export const PRIX_DEFAUT = {
  maconnerie: 22,   // $/m² mur en blocs posés
  beton: 180,       // $/m³ béton armé (dalles, poteaux, poutres)
  enduit: 6,        // $/m² enduit
  peinture: 4,      // $/m²
  carrelage: 18,    // $/m²
  porte: 120,       // $/u
  fenetre: 150,     // $/u
  baie: 400,        // $/u
  toiture: 35,      // $/m²
};

export function nouvelleEtude(nom = 'Nouvelle étude') {
  return {
    id: uid(),
    nom,
    client: '',
    lieu: '',
    typeBatiment: 'Maison',
    toit: 'plat',
    prix: { ...PRIX_DEFAUT },
    niveaux: [nouveauNiveau('Rez-de-chaussée')],
    version: 0,
    creeLe: new Date().toISOString(),
  };
}

export function nouveauNiveau(nom = 'Niveau', hauteur = 3) {
  return { id: uid(), nom, hauteur, murs: [], ouvertures: [], pieces: [], cotes: [], textes: [] };
}

// ---------------- Géométrie ----------------
export const longueur = (m) => Math.hypot(m.x2 - m.x1, m.y2 - m.y1);

export function projeterSurSegment(px, py, m) {
  const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - m.x1) * dx + (py - m.y1) * dy) / l2));
  const x = m.x1 + t * dx, y = m.y1 + t * dy;
  return { t, x, y, d: Math.hypot(px - x, py - y), dist: t * Math.sqrt(l2) };
}

export function aire(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [a, b] = [points[i], points[(i + 1) % points.length]];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function centroide(points) {
  const n = points.length || 1;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

export function pointDansPolygone(x, y, pts) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans;
  }
  return dedans;
}

export function boite(niveau) {
  const xs = [], ys = [];
  for (const m of niveau.murs) { xs.push(m.x1, m.x2); ys.push(m.y1, m.y2); }
  for (const p of niveau.pieces) for (const q of p.points) { xs.push(q.x); ys.push(q.y); }
  if (!xs.length) return null;
  return { x: Math.min(...xs), y: Math.min(...ys), X: Math.max(...xs), Y: Math.max(...ys), get w() { return this.X - this.x; }, get h() { return this.Y - this.y; } };
}

export function boiteEtude(etude) {
  const bs = etude.niveaux.map(boite).filter(Boolean);
  if (!bs.length) return null;
  const b = { x: Math.min(...bs.map((v) => v.x)), y: Math.min(...bs.map((v) => v.y)), X: Math.max(...bs.map((v) => v.X)), Y: Math.max(...bs.map((v) => v.Y)) };
  b.w = b.X - b.x; b.h = b.Y - b.y;
  return b;
}

/** Ouvertures d'un mur, triées, avec leur intervalle [a, b] le long du mur. */
export function ouverturesDuMur(niveau, mur) {
  return niveau.ouvertures.filter((o) => o.murId === mur.id)
    .map((o) => ({ ...o, a: o.position - o.largeur / 2, b: o.position + o.largeur / 2 }))
    .sort((p, q) => p.a - q.a);
}

/** Vérifie qu'une ouverture tient sur le mur sans chevaucher les autres. */
export function ouvertureValide(niveau, mur, position, largeur, ignorerId = null) {
  const L = longueur(mur);
  if (position - largeur / 2 < 0.05 || position + largeur / 2 > L - 0.05) return false;
  return !ouverturesDuMur(niveau, mur).some((o) => o.id !== ignorerId && position + largeur / 2 > o.a - 0.05 && position - largeur / 2 < o.b + 0.05);
}

// ---------------- Métré ----------------
export function metreNiveau(n) {
  const murs = n.murs.map((m) => ({ m, L: longueur(m) }));
  const ext = murs.filter((x) => x.m.exterieur), int = murs.filter((x) => !x.m.exterieur);
  const surfOuv = n.ouvertures.reduce((s, o) => s + o.largeur * o.hauteur, 0);
  const surfMursBrute = murs.reduce((s, x) => s + x.L * n.hauteur, 0);
  const surfMursNette = Math.max(0, surfMursBrute - surfOuv);
  const pieces = n.pieces.map((p) => ({ nom: p.nom, surface: aire(p.points) }));
  const b = boite(n);
  return {
    niveau: n.nom,
    hauteur: n.hauteur,
    lineaireExt: ext.reduce((s, x) => s + x.L, 0),
    lineaireInt: int.reduce((s, x) => s + x.L, 0),
    surfMursNette,
    volumeMurs: murs.reduce((s, x) => s + x.L * n.hauteur * x.m.epaisseur, 0) - n.ouvertures.reduce((s, o) => {
      const m = n.murs.find((w) => w.id === o.murId); return s + (m ? o.largeur * o.hauteur * m.epaisseur : 0);
    }, 0),
    blocs: Math.ceil(surfMursNette * 12.5),
    emprise: b ? b.w * b.h : 0,
    dimensions: b ? `${fmt(b.w)} × ${fmt(b.h)} m` : '–',
    surfacePieces: pieces.reduce((s, p) => s + p.surface, 0),
    pieces,
    portes: n.ouvertures.filter((o) => o.type === 'porte').length,
    fenetres: n.ouvertures.filter((o) => o.type === 'fenetre').length,
    baies: n.ouvertures.filter((o) => o.type === 'baie').length,
  };
}

export function metreEtude(etude) {
  const niveaux = etude.niveaux.map(metreNiveau);
  const t = (k) => niveaux.reduce((s, n) => s + n[k], 0);
  const emprise = Math.max(0, ...niveaux.map((n) => n.emprise));
  const q = {
    maconnerie: t('surfMursNette'),
    beton: niveaux.reduce((s, n) => s + n.emprise * 0.16, 0) + t('volumeMurs') * 0.08, // dalles 16 cm + ossature ≈ 8 % du volume des murs
    enduit: t('surfMursNette') * 2,
    peinture: t('surfMursNette') * 2,
    carrelage: t('surfacePieces'),
    porte: t('portes'), fenetre: t('fenetres'), baie: t('baies'),
    toiture: emprise * (etude.toit === 'plat' ? 1 : 1.25),
  };
  const prix = { ...PRIX_DEFAUT, ...(etude.prix || {}) };
  const lignes = [
    ['Maçonnerie (blocs)', q.maconnerie, 'm²', 'maconnerie'],
    ['Béton armé (dalles + ossature, estimation)', q.beton, 'm³', 'beton'],
    ['Enduits (2 faces)', q.enduit, 'm²', 'enduit'],
    ['Peinture', q.peinture, 'm²', 'peinture'],
    ['Revêtement de sol', q.carrelage, 'm²', 'carrelage'],
    ['Portes', q.porte, 'u', 'porte'],
    ['Fenêtres', q.fenetre, 'u', 'fenetre'],
    ['Baies', q.baie, 'u', 'baie'],
    ['Toiture / étanchéité', q.toiture, 'm²', 'toiture'],
  ].map(([libelle, quantite, unite, cle]) => ({ libelle, quantite, unite, cle, pu: prix[cle], total: quantite * prix[cle] }));
  return {
    niveaux,
    surfaceTotale: t('surfacePieces'),
    emprise,
    blocs: t('blocs'),
    lignes,
    totalGrosOeuvre: lignes.reduce((s, l) => s + l.total, 0),
  };
}

/** Résumé textuel compact envoyé aux agents IA. */
export function resumePourAgents(etude) {
  const me = metreEtude(etude);
  const r = (v) => Math.round(v * 100) / 100;
  const plan = {
    etude: { nom: etude.nom, client: etude.client, lieu: etude.lieu, type: etude.typeBatiment, toit: etude.toit },
    niveaux: etude.niveaux.map((n) => ({
      nom: n.nom, hauteur: n.hauteur,
      murs: n.murs.map((m, i) => ({ i, x1: r(m.x1), y1: r(m.y1), x2: r(m.x2), y2: r(m.y2), ep: m.epaisseur, ext: !!m.exterieur, L: r(longueur(m)) })),
      ouvertures: n.ouvertures.map((o) => ({ mur: n.murs.findIndex((m) => m.id === o.murId), type: o.type, pos: r(o.position), l: o.largeur, h: o.hauteur, allege: o.allege })),
      pieces: n.pieces.map((p) => ({ nom: p.nom, surface: r(aire(p.points)), points: p.points.map((q) => [r(q.x), r(q.y)]) })),
    })),
  };
  const metre = [
    `Surface des pièces : ${fmt(me.surfaceTotale)} m² — Emprise : ${fmt(me.emprise)} m² — Blocs estimés : ${me.blocs}`,
    ...me.niveaux.map((n) => `${n.niveau} (h ${n.hauteur} m, ${n.dimensions}) : murs ext ${fmt(n.lineaireExt)} ml, int ${fmt(n.lineaireInt)} ml, maçonnerie nette ${fmt(n.surfMursNette)} m², ${n.portes} portes, ${n.fenetres} fenêtres, ${n.baies} baies`),
    `Estimation gros œuvre et finitions (prix unitaires de l'atelier) : ${fmt(me.totalGrosOeuvre, 0)} $`,
  ].join('\n');
  return `PLAN (JSON) :\n${JSON.stringify(plan)}\n\nMÉTRÉ :\n${metre}`;
}

/** Convertit une proposition de l'agent architecte en niveau. */
export function niveauDepuisProposition(p) {
  const n = nouveauNiveau(p.nom_niveau || 'Proposition', p.hauteur || 3);
  n.murs = p.murs.map((m) => ({ id: uid(), x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, epaisseur: m.epaisseur, exterieur: m.exterieur }));
  for (const o of p.ouvertures) {
    const mur = n.murs[o.mur_index];
    if (!mur) continue;
    const L = longueur(mur);
    const position = Math.min(Math.max(o.position, o.largeur / 2 + 0.05), L - o.largeur / 2 - 0.05);
    if (!ouvertureValide(n, mur, position, o.largeur)) continue;
    n.ouvertures.push({ id: uid(), murId: mur.id, type: o.type, position, largeur: o.largeur, hauteur: o.hauteur, allege: o.type === 'porte' ? 0 : o.allege });
  }
  n.pieces = p.pieces.map((r) => ({ id: uid(), nom: r.nom, points: r.points.map((q) => ({ x: q.x, y: q.y })) }));
  return n;
}
