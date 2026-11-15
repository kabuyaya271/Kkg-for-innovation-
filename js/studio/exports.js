// Exports de l'atelier : DXF (AutoCAD), SVG, planche imprimable, JSON, catalogue
import { CONFIG } from '../config.js';
import { longueur, ouverturesDuMur, aire, centroide, metreEtude, boiteEtude, fmt } from './modele.js';

export function telecharger(nom, contenu, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(contenu instanceof Blob ? contenu : new Blob([contenu], { type }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const propre = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
export const nomFichier = (etude, suffixe, ext) => `${propre(etude.nom || 'etude')}${suffixe ? `-${propre(suffixe)}` : ''}.${ext}`;

// ---------------- DXF (R12 ASCII, unités : mètres, Y inversé) ----------------
export function exporterDXF(etude, niveau) {
  const L = [];
  const p = (...v) => L.push(...v.map(String));
  const f = (v) => (Math.round(v * 10000) / 10000).toString();
  const ligne = (calque, x1, y1, x2, y2) => p(0, 'LINE', 8, calque, 10, f(x1), 20, f(-y1), 30, 0, 11, f(x2), 21, f(-y2), 31, 0);
  const texte = (calque, x, y, h, t, rot = 0) => p(0, 'TEXT', 8, calque, 10, f(x), 20, f(-y), 30, 0, 40, f(h), 1, t.replace(/\n/g, ' '), 50, f(rot));
  const poly = (calque, pts, ferme = true) => {
    p(0, 'POLYLINE', 8, calque, 66, 1, 70, ferme ? 1 : 0);
    for (const q of pts) p(0, 'VERTEX', 8, calque, 10, f(q.x), 20, f(-q.y), 30, 0);
    p(0, 'SEQEND', 8, calque);
  };
  const calques = [['MURS_EXT', 7], ['MURS_INT', 8], ['OUVERTURES', 4], ['PIECES', 3], ['COTES', 1], ['TEXTES', 2], ['AXES', 9]];
  p(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$INSBASE', 10, 0, 20, 0, 30, 0, 0, 'ENDSEC');
  p(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, calques.length);
  for (const [nom, couleur] of calques) p(0, 'LAYER', 2, nom, 70, 0, 62, couleur, 6, 'CONTINUOUS');
  p(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');

  for (const m of niveau.murs) {
    const Lm = longueur(m); if (Lm < 1e-6) continue;
    const ux = (m.x2 - m.x1) / Lm, uy = (m.y2 - m.y1) / Lm, nx = -uy, ny = ux, h = m.epaisseur / 2;
    const P = (s, k) => ({ x: m.x1 + ux * s + nx * h * k, y: m.y1 + uy * s + ny * h * k });
    const calque = m.exterieur ? 'MURS_EXT' : 'MURS_INT';
    ligne('AXES', m.x1, m.y1, m.x2, m.y2);
    const ouv = ouverturesDuMur(niveau, m);
    let s = 0;
    const plein = (a, b) => {
      for (const k of [1, -1]) { const A = P(a, k), B = P(b, k); ligne(calque, A.x, A.y, B.x, B.y); }
    };
    for (const o of ouv) {
      plein(s, o.a);
      const A1 = P(o.a, 1), A2 = P(o.a, -1), B1 = P(o.b, 1), B2 = P(o.b, -1);
      ligne(calque, A1.x, A1.y, A2.x, A2.y); ligne(calque, B1.x, B1.y, B2.x, B2.y);
      if (o.type === 'porte') {
        const F = { x: A1.x + nx * o.largeur, y: A1.y + ny * o.largeur };
        ligne('OUVERTURES', A1.x, A1.y, F.x, F.y);
        const a0 = (Math.atan2(-(B1.y - A1.y), B1.x - A1.x) * 180) / Math.PI;
        const a1 = (Math.atan2(-(F.y - A1.y), F.x - A1.x) * 180) / Math.PI;
        const [d, e] = ((a1 - a0 + 360) % 360) <= 180 ? [a0, a1] : [a1, a0];
        p(0, 'ARC', 8, 'OUVERTURES', 10, f(A1.x), 20, f(-A1.y), 30, 0, 40, f(o.largeur), 50, f(d), 51, f(e));
      } else {
        const M1 = P(o.a, 0), M2 = P(o.b, 0);
        ligne('OUVERTURES', A1.x, A1.y, B1.x, B1.y); ligne('OUVERTURES', A2.x, A2.y, B2.x, B2.y); ligne('OUVERTURES', M1.x, M1.y, M2.x, M2.y);
      }
      s = o.b;
    }
    plein(s, Lm);
    for (const s0 of [0, Lm]) { const A = P(s0, 1), B = P(s0, -1); ligne(calque, A.x, A.y, B.x, B.y); }
  }
  for (const r of niveau.pieces) {
    poly('PIECES', r.points);
    const c = centroide(r.points);
    texte('TEXTES', c.x - 0.6, c.y, 0.25, r.nom);
    texte('TEXTES', c.x - 0.6, c.y + 0.35, 0.18, `${fmt(aire(r.points))} m2`);
  }
  for (const c of niveau.cotes) {
    const dx = c.x2 - c.x1, dy = c.y2 - c.y1, Lc = Math.hypot(dx, dy) || 1, nx = -dy / Lc, ny = dx / Lc;
    const a = { x: c.x1 + nx * c.decalage, y: c.y1 + ny * c.decalage }, b = { x: c.x2 + nx * c.decalage, y: c.y2 + ny * c.decalage };
    ligne('COTES', c.x1, c.y1, a.x, a.y); ligne('COTES', c.x2, c.y2, b.x, b.y); ligne('COTES', a.x, a.y, b.x, b.y);
    texte('COTES', (a.x + b.x) / 2 + nx * 0.15, (a.y + b.y) / 2 + ny * 0.15, 0.2, fmt(Lc), (Math.atan2(-dy, dx) * 180) / Math.PI);
  }
  for (const t of niveau.textes) texte('TEXTES', t.x, t.y, t.taille, t.texte);
  p(0, 'ENDSEC', 0, 'EOF');
  // DXF R12 : texte en Windows-1252 (les accents s'affichent correctement dans AutoCAD)
  const texteDxf = L.join('\r\n');
  const cp1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f };
  const octets = new Uint8Array(texteDxf.length);
  for (let i = 0; i < texteDxf.length; i++) {
    const c = texteDxf[i], code = texteDxf.charCodeAt(i);
    octets[i] = code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : cp1252[c] ?? 0x3f;
  }
  return new Blob([octets], { type: 'application/dxf' });
}

// ---------------- Planche imprimable (PDF via impression) ----------------
export function planche(etude, niveau, svg, poste, echelleTexte) {
  const ent = CONFIG.entreprise;
  const me = metreEtude(etude);
  const n = me.niveaux.find((x) => x.niveau === niveau.nom) || me.niveaux[0];
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${etude.nom} — ${niveau.nom}</title>
<style>@page{size:A3 landscape;margin:10mm}body{margin:0;font:11px Arial,sans-serif;color:#111}
.feuille{display:grid;grid-template-columns:1fr 270px;gap:10px;height:calc(100vh - 20px);padding:10px;box-sizing:border-box}
.plan{border:1px solid #111;display:flex;align-items:center;justify-content:center;overflow:hidden}.plan svg{max-width:100%;max-height:100%;height:auto}
.cartouche{border:2px solid #111;display:flex;flex-direction:column}.cartouche div{border-bottom:1px solid #111;padding:6px 8px}
.cartouche b{display:block;font-size:10px;text-transform:uppercase;color:#555;font-weight:normal}.cartouche .titre{font-size:18px;font-weight:bold}
table{width:100%;border-collapse:collapse;font-size:10px}td{padding:2px 0;border-bottom:1px dotted #aaa}td:last-child{text-align:right}
.noprint{position:fixed;top:8px;right:290px}@media print{.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="print()">Imprimer / enregistrer en PDF</button>
<div class="feuille"><div class="plan">${svg}</div><div class="cartouche">
<div><span class="titre">${ent.raisonSociale}</span><br>${ent.siege}<br>${CONFIG.telephone}</div>
<div><b>Projet</b><span class="titre">${etude.nom}</span></div>
<div><b>Client</b>${etude.client || '—'}</div><div><b>Lieu</b>${etude.lieu || '—'}</div>
<div><b>Document</b>Plan — ${niveau.nom} (h ${niveau.hauteur} m)</div>
<div><b>Échelle</b>${echelleTexte}</div>
<div><b>Surfaces</b><table>${n.pieces.map((p) => `<tr><td>${p.nom}</td><td>${fmt(p.surface)} m²</td></tr>`).join('')}<tr><td><strong>Total</strong></td><td><strong>${fmt(n.surfacePieces)} m²</strong></td></tr></table></div>
<div><b>Emprise</b>${n.dimensions}</div>
<div><b>Dessiné par</b>${poste?.nom || '—'} — ${new Date().toLocaleDateString('fr-FR')}</div>
<div><b>Indice</b>v${etude.version || 1}</div>
<div style="flex:1;font-size:9px;color:#444">Document de conception — propriété de ${ent.raisonSociale}. Reproduction interdite. Ne vaut pas plan d'exécution : structure et fondations à établir par un ingénieur qualifié.</div>
</div></div></body></html>`;
}

// ---------------- Vers le catalogue du site ----------------
export function versCatalogue(etude) {
  const me = metreEtude(etude);
  const b = boiteEtude(etude) || { w: 10, h: 10 };
  const toutes = me.niveaux.flatMap((n) => n.pieces);
  const id = nomFichier(etude, '', 'x').replace(/\.x$/, '').replace(/-$/, '');
  const type = { Maison: 'maison', Villa: 'villa', Duplex: 'duplex', Immeuble: 'immeuble', Commercial: 'commercial' }[etude.typeBatiment] || 'maison';
  return {
    id,
    statut: 'en-vente',
    titre: etude.nom,
    categorie: type === 'commercial' ? 'Commercial' : type === 'immeuble' ? 'Immeuble' : 'Résidentiel',
    style: '',
    resume: '',
    description: '',
    prix: 0,
    surface: Math.round(me.surfaceTotale),
    chambres: toutes.filter((p) => /chambre|suite/i.test(p.nom)).length,
    sallesDeBain: toutes.filter((p) => /bain|douche|sdb|sde/i.test(p.nom)).length,
    etages: etude.niveaux.length,
    terrain: '',
    budgetEstime: '',
    delaiConstruction: '',
    vedette: false,
    nouveau: true,
    caracteristiques: [],
    inclus: ['Plans de chaque niveau cotés', 'Façades et coupes', 'Plan de toiture', 'Plan de fondations'],
    modele: {
      type, etages: etude.niveaux.length, largeur: Math.round(b.w * 10) / 10, profondeur: Math.round(b.h * 10) / 10,
      hauteurEtage: etude.niveaux[0]?.hauteur || 3, toit: etude.toit, couleurMur: '#efe9df', couleurToit: '#3a3a3a', couleurAccent: '#b8894d',
      piscine: false, garage: false, balcons: false, decalage: 0, arbres: true,
    },
    modeleGLB: `modeles/${id}.glb`,
    images: [],
    lienPaiement: '',
    prive: {
      dimensions: `${fmt(b.w)} × ${fmt(b.h)} m`,
      pieces: me.niveaux.flatMap((n) => n.pieces.map((p) => ({ nom: etude.niveaux.length > 1 ? `${p.nom} (${n.niveau})` : p.nom, surface: Math.round(p.surface * 10) / 10 }))),
      descriptionArchitecturale: '',
      notesTechniques: `Étude « ${etude.nom} » issue de l'atelier (v${etude.version || 1}).`,
    },
  };
}
