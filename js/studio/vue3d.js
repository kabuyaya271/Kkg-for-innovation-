// Construction de la maquette 3D à partir du plan de l'étude
import * as THREE from 'three';
import { longueur, ouverturesDuMur, boiteEtude, boite } from './modele.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });

export function construireEtude3D(etude, { exterieurSeul = false, niveauActif = null } = {}) {
  const M = {
    mext: std('#ece6db'), mint: std('#f6f3ee'), dalle: std('#d6d0c6'), toit: std('#4a4a4a', { roughness: 0.7 }),
    cadre: std('#2b2b2b', { metalness: 0.4, roughness: 0.4 }),
    verre: new THREE.MeshStandardMaterial({ color: '#8fb3cc', roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0 }),
    porte: std('#8a5a35', { roughness: 0.6 }), sol: std('#bfb8ab'), herbe: std('#7e9b5c', { roughness: 0.95 }),
    actif: std('#c9a46a'),
  };
  const racine = new THREE.Group();
  const niveaux3d = [];
  const be = boiteEtude(etude);
  const cx = be ? be.x + be.w / 2 : 0, cz = be ? be.y + be.h / 2 : 0;
  const X = (x) => x - cx, Z = (y) => y - cz;

  const boiteMesh = (parent, w, h, d, x, y, z, rotY, mat) => {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
  };

  let altitude = 0.15;
  etude.niveaux.forEach((n, idx) => {
    const g = new THREE.Group();
    g.name = `niveau-${idx}`;
    g.userData.index = idx;
    const H = n.hauteur - 0.2; // hauteur des murs sous la dalle de 20 cm
    for (const m of n.murs) {
      if (exterieurSeul && !m.exterieur) continue;
      const L = longueur(m); if (L < 0.01) continue;
      const ang = Math.atan2(m.y2 - m.y1, m.x2 - m.x1);
      const ux = (m.x2 - m.x1) / L, uy = (m.y2 - m.y1) / L;
      const mat = niveauActif === idx && !exterieurSeul ? (m.exterieur ? M.mext : M.mint) : (m.exterieur ? M.mext : M.mint);
      const ep = m.epaisseur;
      const morceau = (s0, s1, y0, y1, materiau = mat, epaisseur = ep) => {
        const mid = (s0 + s1) / 2;
        boiteMesh(g, s1 - s0, y1 - y0, epaisseur, X(m.x1 + ux * mid), altitude + (y0 + y1) / 2, Z(m.y1 + uy * mid), -ang, materiau);
      };
      const ouv = ouverturesDuMur(n, m);
      let s = -ep / 2;
      for (const o of ouv) {
        morceau(s, o.a, 0, H);
        const haut = Math.min(H, o.allege + o.hauteur);
        if (o.allege > 0) morceau(o.a, o.b, 0, o.allege);
        if (haut < H) morceau(o.a, o.b, haut, H);
        if (o.type === 'porte') morceau(o.a + 0.02, o.b - 0.02, 0, haut - 0.02, M.porte, 0.05);
        else { morceau(o.a, o.b, o.allege, haut, M.verre, 0.03); morceau(o.a, o.b, haut - 0.05, haut, M.cadre, ep + 0.02); }
        s = o.b;
      }
      morceau(s, L + ep / 2, 0, H);
    }
    // dalle (plancher haut)
    const b = boite(n);
    if (b) boiteMesh(g, b.w + 0.3, 0.2, b.h + 0.3, X(b.x + b.w / 2), altitude + H + 0.1, Z(b.y + b.h / 2), 0, M.dalle);
    // sols des pièces
    if (!exterieurSeul) {
      for (const p of n.pieces) {
        if (p.points.length < 3) continue;
        const forme = new THREE.Shape(p.points.map((q) => new THREE.Vector2(X(q.x), -Z(q.y))));
        const geo = new THREE.ShapeGeometry(forme);
        geo.rotateX(-Math.PI / 2);
        const sol = new THREE.Mesh(geo, M.sol);
        sol.position.y = altitude + 0.01;
        sol.receiveShadow = true;
        g.add(sol);
      }
    }
    g.userData.y0 = 0;
    racine.add(g);
    niveaux3d.push(g);
    altitude += n.hauteur;
  });

  // toiture
  const derniere = etude.niveaux.length ? boite(etude.niveaux[etude.niveaux.length - 1]) : null;
  const toit = new THREE.Group();
  toit.name = 'toiture';
  toit.userData.index = etude.niveaux.length;
  if (derniere) {
    const w = derniere.w + 0.8, d = derniere.h + 0.8, x = X(derniere.x + derniere.w / 2), z = Z(derniere.y + derniere.h / 2);
    if (etude.toit === 'deux-pans') {
      const rh = Math.max(1.2, w * 0.22);
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, rh); s.lineTo(-w / 2, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
      geo.translate(0, 0, -d / 2);
      const m = new THREE.Mesh(geo, M.toit); m.position.set(x, altitude, z); m.castShadow = true; toit.add(m);
    } else if (etude.toit === 'quatre-pans') {
      const rh = Math.max(1.2, Math.min(w, d) * 0.3);
      const geo = new THREE.ConeGeometry(1, rh, 4, 1); geo.rotateY(Math.PI / 4);
      const m = new THREE.Mesh(geo, M.toit); m.scale.set(w / Math.SQRT2, 1, d / Math.SQRT2);
      m.position.set(x, altitude + rh / 2, z); m.castShadow = true; toit.add(m);
    } else {
      const ha = 0.6;
      boiteMesh(toit, w - 0.6, ha, 0.15, x, altitude + ha / 2, z - (d - 0.8) / 2, 0, M.mext);
      boiteMesh(toit, w - 0.6, ha, 0.15, x, altitude + ha / 2, z + (d - 0.8) / 2, 0, M.mext);
      boiteMesh(toit, 0.15, ha, d - 0.6, x - (w - 0.8) / 2, altitude + ha / 2, z, 0, M.mext);
      boiteMesh(toit, 0.15, ha, d - 0.6, x + (w - 0.8) / 2, altitude + ha / 2, z, 0, M.mext);
    }
  }
  racine.add(toit);
  niveaux3d.push(toit);

  // terrain
  const R = be ? Math.max(be.w, be.h) * 1.4 + 8 : 15;
  const sol = new THREE.Mesh(new THREE.CircleGeometry(R, 64), M.herbe);
  sol.rotation.x = -Math.PI / 2; sol.receiveShadow = true;
  racine.add(sol);
  if (be) boiteMesh(racine, be.w + 1, 0.15, be.h + 1, 0, 0.075, 0, 0, M.dalle);

  racine.userData = { niveaux: niveaux3d, materiaux: M, dims: { w: be?.w || 10, d: be?.h || 10, hauteur: altitude } };
  return racine;
}

/** Exporte un objet 3D en fichier .glb */
export async function exporterGLB(objet) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  return new Promise((ok, ko) => {
    new GLTFExporter().parse(objet, (res) => ok(new Blob([res], { type: 'model/gltf-binary' })), ko, { binary: true });
  });
}
