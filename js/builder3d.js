// Générateur procédural de maquettes 3D à partir des paramètres d'un projet.
// Chaque niveau est un groupe séparé (utilisé pour la "vue éclatée").
import * as THREE from 'three';

export const MODELE_DEFAUT = {
  type: 'villa',            // villa | maison | duplex | immeuble | commercial
  etages: 2,
  largeur: 14,              // m (axe X, façade principale)
  profondeur: 10,           // m (axe Z)
  hauteurEtage: 3.2,        // m
  toit: 'plat',             // plat | deux-pans | quatre-pans
  couleurMur: '#efe9df',
  couleurToit: '#3a3a3a',
  couleurAccent: '#b8894d',
  piscine: false,
  garage: false,
  balcons: true,
  decalage: 0,              // porte-à-faux des niveaux impairs (m)
  arbres: true,
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });

function box(parent, w, h, d, x, y, z, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

// Générateur pseudo-aléatoire déterministe (même projet = même maquette)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Place des fenêtres sur une façade.
 * face : 'avant' | 'arriere' | 'gauche' | 'droite'
 */
function fenetres(g, M, { face, w, d, cx, y, nb, fw, fh, eviterCentre = 0 }) {
  const long = face === 'avant' || face === 'arriere' ? w : d;
  for (let k = 0; k < nb; k++) {
    const t = -long / 2 + ((k + 0.5) * long) / nb;
    if (eviterCentre && Math.abs(t) < eviterCentre) continue;
    const grp = new THREE.Group();
    box(grp, fw + 0.14, fh + 0.14, 0.08, 0, 0, 0, M.cadre, { cast: false });
    box(grp, fw, fh, 0.1, 0, 0, 0.02, M.verre, { cast: false });
    // meneau
    box(grp, 0.05, fh, 0.12, 0, 0, 0.03, M.cadre, { cast: false });
    switch (face) {
      case 'avant': grp.position.set(cx + t, y, d / 2 + 0.02); break;
      case 'arriere': grp.position.set(cx + t, y, -d / 2 - 0.02); grp.rotation.y = Math.PI; break;
      case 'gauche': grp.position.set(cx - w / 2 - 0.02, y, t); grp.rotation.y = -Math.PI / 2; break;
      case 'droite': grp.position.set(cx + w / 2 + 0.02, y, t); grp.rotation.y = Math.PI / 2; break;
    }
    g.add(grp);
  }
}

function arbre(parent, x, z, h, M) {
  const g = new THREE.Group();
  box(g, 0.25, h * 0.45, 0.25, 0, h * 0.225, 0, M.tronc);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.32, 0), M.feuillage);
  f.position.y = h * 0.62;
  f.castShadow = true;
  g.add(f);
  g.position.set(x, 0, z);
  parent.add(g);
}

export function construireProjet(entree = {}) {
  const p = { ...MODELE_DEFAUT, ...entree };
  const w = Math.max(4, +p.largeur);
  const d = Math.max(4, +p.profondeur);
  const h = Math.max(2.5, +p.hauteurEtage);
  const n = Math.max(1, Math.min(30, Math.round(+p.etages)));
  const seed = Math.round(w * 131 + d * 17 + n * 7 + h * 3);
  const rand = rng(seed);

  const M = {
    mur: std(p.couleurMur, { roughness: 0.92 }),
    toit: std(p.couleurToit, { roughness: 0.7 }),
    accent: std(p.couleurAccent, { roughness: 0.55 }),
    dalle: std('#d8d2c8'),
    cadre: std('#2a2a2a', { roughness: 0.4, metalness: 0.5 }),
    verre: new THREE.MeshStandardMaterial({
      color: '#8fb3cc', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.78,
      emissive: '#ffcf8a', emissiveIntensity: 0,
    }),
    garde: new THREE.MeshStandardMaterial({ color: '#cfe3ef', roughness: 0.05, transparent: true, opacity: 0.35 }),
    herbe: std('#7e9b5c'),
    terrain: std('#c9c2b4'),
    allee: std('#9b948a'),
    eau: new THREE.MeshStandardMaterial({ color: '#3fa7c9', roughness: 0.05, metalness: 0.2, emissive: '#0b4a63', emissiveIntensity: 0.25 }),
    tronc: std('#6b4c32'),
    feuillage: std('#4f7a3a', { flatShading: true }),
  };

  const racine = new THREE.Group();
  racine.name = 'projet';
  const niveaux = [];

  // ---------- Terrain ----------
  const marge = Math.max(w, d) * 0.6 + 8;
  const site = new THREE.Group();
  site.name = 'site';
  const sol = new THREE.Mesh(new THREE.CircleGeometry(marge * 2.2, 64), M.herbe);
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  site.add(sol);
  box(site, w + 6 + (p.garage ? 5 : 0), 0.08, d + 10 + (p.piscine ? 6 : 0), p.garage ? 2.5 : 0, 0.04, p.piscine ? -3 : 0, M.terrain, { cast: false });
  box(site, 2.2, 0.1, marge, 0, 0.05, d / 2 + marge / 2, M.allee, { cast: false });
  box(site, w + 0.8, 0.3, d + 0.8, 0, 0.15, 0, M.dalle); // soubassement
  racine.add(site);

  const vitre = p.type === 'commercial';
  const immeuble = p.type === 'immeuble';

  // ---------- Niveaux ----------
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.name = `niveau-${i}`;
    const y0 = 0.3 + i * h;
    const cx = i % 2 === 1 ? +p.decalage || 0 : 0;
    const hc = h - 0.25;

    // Corps
    if (vitre) {
      box(g, w, hc, d, cx, y0 + hc / 2, 0, M.verre);
      const nbM = Math.max(3, Math.round(w / 1.6));
      for (let k = 0; k <= nbM; k++) {
        const x = cx - w / 2 + (k * w) / nbM;
        box(g, 0.08, hc, 0.1, x, y0 + hc / 2, d / 2 + 0.03, M.cadre, { cast: false });
        box(g, 0.08, hc, 0.1, x, y0 + hc / 2, -d / 2 - 0.03, M.cadre, { cast: false });
      }
      const nbZ = Math.max(3, Math.round(d / 1.6));
      for (let k = 0; k <= nbZ; k++) {
        const z = -d / 2 + (k * d) / nbZ;
        box(g, 0.1, hc, 0.08, cx - w / 2 - 0.03, y0 + hc / 2, z, M.cadre, { cast: false });
        box(g, 0.1, hc, 0.08, cx + w / 2 + 0.03, y0 + hc / 2, z, M.cadre, { cast: false });
      }
    } else {
      box(g, w, hc, d, cx, y0 + hc / 2, 0, M.mur);
      const yf = y0 + hc * 0.52;
      const rdcVilla = i === 0 && (p.type === 'villa' || p.type === 'duplex');
      const fw = rdcVilla ? 2.4 : immeuble ? 1.3 : 1.5;
      const fh = rdcVilla ? hc * 0.78 : hc * 0.5;
      const pas = rdcVilla ? 4.2 : immeuble ? 2.4 : 3.2;
      const nbAv = Math.max(1, Math.floor(w / pas));
      const nbCo = Math.max(1, Math.floor(d / pas));
      fenetres(g, M, { face: 'avant', w, d, cx, y: rdcVilla ? y0 + hc * 0.42 : yf, nb: nbAv, fw, fh, eviterCentre: i === 0 ? 1.1 : 0 });
      fenetres(g, M, { face: 'arriere', w, d, cx, y: yf, nb: nbAv, fw, fh });
      fenetres(g, M, { face: 'gauche', w, d, cx, y: yf, nb: nbCo, fw: 1.2, fh: hc * 0.45 });
      fenetres(g, M, { face: 'droite', w, d, cx, y: yf, nb: nbCo, fw: 1.2, fh: hc * 0.45 });
    }

    // Porte d'entrée + auvent
    if (i === 0) {
      const ph = Math.min(2.4, hc * 0.85);
      box(g, 1.3, ph, 0.12, cx, y0 + ph / 2, d / 2 + 0.06, vitre ? M.cadre : M.accent, { cast: false });
      box(g, 2.6, 0.15, 1.6, cx, y0 + ph + 0.35, d / 2 + 0.8, M.accent);
    }

    // Dalle haute (bandeau)
    box(g, w + 0.35, 0.25, d + 0.35, cx, y0 + h - 0.125, 0, i === n - 1 && p.toit === 'plat' ? M.accent : M.dalle);

    // Balcons
    if (p.balcons && i > 0 && !vitre) {
      const bw = immeuble ? w * 0.85 : w * 0.55;
      const bz = d / 2 + 0.75;
      box(g, bw, 0.15, 1.5, cx, y0 + 0.07, bz, M.dalle);
      box(g, bw, 1.0, 0.05, cx, y0 + 0.6, d / 2 + 1.48, M.garde, { cast: false });
      box(g, bw, 0.05, 0.08, cx, y0 + 1.1, d / 2 + 1.48, M.cadre, { cast: false });
    }

    g.userData.index = i;
    racine.add(g);
    niveaux.push(g);
  }

  // ---------- Toiture ----------
  const toit = new THREE.Group();
  toit.name = 'toiture';
  const yT = 0.3 + n * h;
  const cxT = (n - 1) % 2 === 1 ? +p.decalage || 0 : 0;
  if (p.toit === 'deux-pans') {
    const rw = w + 1, rh = Math.max(1.2, w * 0.22);
    const s = new THREE.Shape();
    s.moveTo(-rw / 2, 0); s.lineTo(rw / 2, 0); s.lineTo(0, rh); s.lineTo(-rw / 2, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d + 1, bevelEnabled: false });
    geo.translate(0, 0, -(d + 1) / 2);
    const m = new THREE.Mesh(geo, M.toit);
    m.position.set(cxT, yT, 0);
    m.castShadow = m.receiveShadow = true;
    toit.add(m);
    // pignons
    const pg = new THREE.Shape();
    pg.moveTo(-w / 2, 0); pg.lineTo(w / 2, 0); pg.lineTo(0, rh * (w / rw)); pg.lineTo(-w / 2, 0);
    const pgeo = new THREE.ExtrudeGeometry(pg, { depth: d, bevelEnabled: false });
    pgeo.translate(0, 0, -d / 2);
    const pm = new THREE.Mesh(pgeo, M.mur);
    pm.position.set(cxT, yT - 0.02, 0);
    pm.scale.set(0.99, 0.97, 0.99);
    toit.add(pm);
  } else if (p.toit === 'quatre-pans') {
    const rh = Math.max(1.2, Math.min(w, d) * 0.3);
    const geo = new THREE.ConeGeometry(1, rh, 4, 1);
    geo.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(geo, M.toit);
    const k = Math.SQRT1_2;
    m.scale.set((w + 1.2) / (2 * k), 1, (d + 1.2) / (2 * k));
    m.position.set(cxT, yT + rh / 2, 0);
    m.castShadow = m.receiveShadow = true;
    toit.add(m);
  } else {
    // Toit plat : acrotère + édicule
    const ha = 0.7;
    box(toit, w + 0.35, ha, 0.18, cxT, yT + ha / 2, d / 2 + 0.08, M.mur);
    box(toit, w + 0.35, ha, 0.18, cxT, yT + ha / 2, -d / 2 - 0.08, M.mur);
    box(toit, 0.18, ha, d + 0.35, cxT - w / 2 - 0.08, yT + ha / 2, 0, M.mur);
    box(toit, 0.18, ha, d + 0.35, cxT + w / 2 + 0.08, yT + ha / 2, 0, M.mur);
    box(toit, w, 0.06, d, cxT, yT + 0.03, 0, M.toit, { cast: false });
    if (n > 1 || w > 10) {
      box(toit, Math.min(4, w * 0.3), 2.4, Math.min(3.5, d * 0.3), cxT + w * 0.25, yT + 1.2, -d * 0.2, M.mur);
      if (vitre || immeuble) {
        // panneaux solaires
        for (let k = 0; k < 4; k++) {
          const pan = box(toit, 1.6, 0.06, 1, cxT - w * 0.25 + (k % 2) * 1.9, yT + 0.5, -d * 0.15 + Math.floor(k / 2) * 1.4, M.cadre);
          pan.rotation.x = -0.3;
        }
      }
    }
  }
  toit.userData.index = n;
  racine.add(toit);
  niveaux.push(toit);

  // ---------- Annexes ----------
  if (p.garage) {
    const ga = new THREE.Group();
    const gx = w / 2 + 2.6;
    box(ga, 4.4, 2.9, 6.5, gx, 0.3 + 1.45, d / 2 - 3.25, M.mur);
    box(ga, 4.8, 0.2, 6.9, gx, 0.3 + 3.0, d / 2 - 3.25, M.accent);
    box(ga, 3.2, 2.3, 0.1, gx, 0.3 + 1.15, d / 2 + 0.02, M.cadre);
    for (let k = 0; k < 5; k++) box(ga, 3.2, 0.03, 0.12, gx, 0.3 + 0.3 + k * 0.45, d / 2 + 0.04, M.dalle, { cast: false });
    box(ga, 3.6, 0.1, marge, gx, 0.05, d / 2 + marge / 2, M.allee, { cast: false });
    site.add(ga);
  }
  if (p.piscine) {
    const pw = Math.min(10, w * 0.6), pd = 4;
    const pz = -d / 2 - 4.5;
    box(site, pw + 1.6, 0.2, pd + 1.6, 0, 0.1, pz, M.dalle, { cast: false });
    box(site, pw, 0.1, pd, 0, 0.17, pz, M.eau, { cast: false });
    // transats
    for (let k = 0; k < 2; k++) box(site, 0.7, 0.3, 1.8, -pw / 2 - 1.8 + k * 1.1, 0.3, pz, M.accent);
  }
  if (p.arbres) {
    const nb = 6 + Math.floor(rand() * 4);
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + rand() * 0.4;
      const r = Math.max(w, d) / 2 + 5 + rand() * 6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 2.5 && z > 0) continue; // dégager l'allée
      arbre(site, x, z, 3.5 + rand() * 3, M);
    }
  }

  racine.userData = { niveaux, materiaux: M, dims: { w, d, hauteur: yT } };
  return racine;
}

/** Libère la mémoire GPU d'un objet. */
export function liberer(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}
