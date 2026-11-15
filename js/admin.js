import { CONFIG } from './config.js';
import {
  getProjets, enregistrerProjetsLocaux, aDesModificationsLocales, supprimerModificationsLocales,
  getCommandes, majCommande, formatPrix, prixLicence, getRequetesLocales,
} from './store.js';
import { initialiserPage, esc, toast } from './ui.js';
import { Visionneuse } from './viewer.js';
import { MODELE_DEFAUT } from './builder3d.js';
import { journaliser } from './journal.js';
import { initialiserHistorique } from './historique.js';

initialiserPage();
document.querySelectorAll('[data-devise]').forEach((e) => { e.textContent = CONFIG.devise; });

// ---------------- Connexion ----------------
const CLE_SESSION = 'kkg_admin';
const connexion = document.getElementById('connexion');
connexion.addEventListener('submit', (e) => {
  e.preventDefault();
  if (document.getElementById('mdp').value === CONFIG.adminMotDePasse) {
    sessionStorage.setItem(CLE_SESSION, '1');
    ouvrir();
  } else toast('Mot de passe incorrect.', 'err');
});
if (sessionStorage.getItem(CLE_SESSION) === '1') ouvrir();

// ---------------- État ----------------
let projets = [];
let courant = null; // copie en cours d'édition
let indexCourant = -1;
let apercu = null;
let eclate = false, nuit = false;

const form = document.getElementById('formProjet');
const champ = (n) => form.elements.namedItem(n);

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projet';

function projetVierge() {
  return {
    id: '', statut: 'en-vente', titre: 'Nouveau projet', categorie: 'Résidentiel', style: 'Contemporain', resume: '', description: '',
    prix: 200, surface: 120, chambres: 3, sallesDeBain: 2, etages: 1, terrain: '', dimensions: '', budgetEstime: '',
    delaiConstruction: '', vedette: false, nouveau: true, caracteristiques: [], inclus: [
      'Plans de chaque niveau cotés (1/50)', 'Façades et coupes', 'Plan de toiture', 'Plan de fondations',
    ],
    modele: { ...MODELE_DEFAUT, etages: 1 }, modeleGLB: '', images: [], lienPaiement: '',
  };
}

async function ouvrir() {
  connexion.hidden = true;
  document.getElementById('espace').hidden = false;
  projets = migrer(structuredClone(await getProjets()));
  apercu = new Visionneuse(document.getElementById('apercu3d'), { rotationAuto: false });
  majAlerte();
  rendreListe();
  selectionner(0);
  rendreCommandes();
  rendreRequetes();
  initialiserHistorique();
}

function majAlerte() { document.getElementById('alerteLocale').hidden = !aDesModificationsLocales(); }

// ---------------- Onglets ----------------
document.querySelector('.onglets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-onglet]');
  if (!b) return;
  document.querySelectorAll('.onglets button').forEach((x) => x.classList.toggle('actif', x === b));
  document.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== b.dataset.onglet; });
  if (b.dataset.onglet === 'commandes') rendreCommandes();
  if (b.dataset.onglet === 'requetes') rendreRequetes();
});

// ---------------- Liste ----------------
function rendreListe() {
  document.getElementById('liste').innerHTML = projets.map((p, i) => `
    <button class="item ${i === indexCourant ? 'actif' : ''}" data-i="${i}">
      <span>${esc(p.titre)}</span><span class="muted">${formatPrix(p.prix)}</span>
    </button>`).join('') || '<p class="muted" style="padding:.5rem">Aucun projet.</p>';
}
document.getElementById('liste').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) selectionner(+b.dataset.i);
});

function selectionner(i) {
  indexCourant = i;
  courant = projets[i] ? structuredClone(projets[i]) : null;
  if (!courant) { courant = projetVierge(); indexCourant = -1; }
  remplirFormulaire(courant);
  rendreListe();
  majApercu(true);
}

// ---------------- Formulaire <-> objet ----------------
function remplirFormulaire(p) {
  for (const el of form.elements) {
    if (!el.name) continue;
    let a = el.name;
    let v;
    if (el.name.startsWith('m.')) v = p.modele?.[el.name.slice(2)] ?? MODELE_DEFAUT[el.name.slice(2)];
    else if (el.name.startsWith('p.')) { a = el.name.slice(2); v = p.prive?.[a]; }
    else v = p[a];
    if (a === 'caracteristiques' || a === 'inclus') v = (v || []).join('\n');
    if (a === 'pieces') v = (v || []).map((x) => `${x.nom} : ${x.surface}`).join('\n');
    if (a === 'statut' && !v) v = 'en-vente';
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  }
  rendreGalerie();
}

function lireFormulaire() {
  const p = courant;
  p.modele = { ...MODELE_DEFAUT, ...(p.modele || {}) };
  for (const el of form.elements) {
    if (!el.name) continue;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value.trim();
    if (el.name.startsWith('m.')) { p.modele[el.name.slice(2)] = v; continue; }
    if (el.name === 'caracteristiques' || el.name === 'inclus') v = v.split('\n').map((s) => s.trim()).filter(Boolean);
    if (el.name === 'p.pieces') {
      v = v.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = /^(.*?)[\s:;–-]+(\d+(?:[.,]\d+)?)\s*(m²|m2)?$/i.exec(l);
        return m ? { nom: m[1].trim(), surface: +m[2].replace(',', '.') } : { nom: l, surface: '' };
      });
    }
    if (el.name.startsWith('p.')) { p.prive = { ...(p.prive || {}), [el.name.slice(2)]: v }; continue; }
    p[el.name] = v;
  }
  p.etages = p.modele.etages;
  return p;
}

let minuterie;
form.addEventListener('input', (e) => {
  lireFormulaire();
  if (e.target.name === 'titre' && indexCourant === -1 && !champ('id').dataset.touche) champ('id').value = slug(e.target.value);
  if (e.target.name === 'id') champ('id').dataset.touche = '1';
  clearTimeout(minuterie);
  minuterie = setTimeout(() => majApercu(false), 120);
});
form.addEventListener('change', () => { lireFormulaire(); majApercu(false); });

function majApercu(recadrer) {
  if (!apercu) return;
  const p = courant;
  if (p.modeleGLB && recadrer) apercu.chargerGLB(p.modeleGLB).catch(() => apercu.afficherProjet(p.modele));
  else if (!p.modeleGLB || recadrer) apercu.afficherProjet(p.modele, { garderVue: !recadrer });
  apercu.definirNuit(nuit);
  document.getElementById('apPrix').innerHTML = 'Prix de vente : ' + Object.entries(CONFIG.licences)
    .map(([k, l]) => `${esc(l.nom)} <b>${formatPrix(prixLicence({ prix: +p.prix || 0 }, k))}</b>`).join(' · ');
}

// ---------------- Images ----------------
function rendreGalerie() {
  document.getElementById('galerie').innerHTML = (courant.images || []).map((src, i) => `
    <div><img src="${esc(src)}" alt=""><button type="button" data-suppr-img="${i}" title="Retirer">✕</button></div>`).join('');
}
document.getElementById('galerie').addEventListener('click', (e) => {
  const b = e.target.closest('[data-suppr-img]');
  if (b) { courant.images.splice(+b.dataset.supprImg, 1); rendreGalerie(); }
});

function reduireImage(fichier, max = 1600) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = ko;
    img.src = URL.createObjectURL(fichier);
  });
}
document.getElementById('ajoutImages').addEventListener('change', async (e) => {
  courant.images = courant.images || [];
  for (const f of e.target.files) courant.images.push(await reduireImage(f));
  e.target.value = '';
  rendreGalerie();
  toast('Images ajoutées — pensez à enregistrer.');
});

// ---------------- Aperçu 3D ----------------
document.getElementById('apEclate').addEventListener('click', (e) => { eclate = !eclate; apercu.definirEclatement(eclate ? 1 : 0); e.target.classList.toggle('actif', eclate); });
document.getElementById('apNuit').addEventListener('click', () => { nuit = !nuit; apercu.definirNuit(nuit); });
document.getElementById('apRecentrer').addEventListener('click', () => apercu.cadrer());
document.getElementById('apCapture').addEventListener('click', () => {
  courant.images = courant.images || [];
  courant.images.push(apercu.capture(1400));
  rendreGalerie();
  toast('Capture ajoutée à la galerie.');
});
document.getElementById('testGLB').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  apercu.chargerGLB(URL.createObjectURL(f))
    .then(() => toast(`Modèle « ${esc(f.name)} » chargé. Copiez-le dans <code>modeles/</code> puis indiquez <code>modeles/${esc(f.name)}</code>.`))
    .catch(() => toast('Fichier 3D illisible.', 'err'));
  e.target.value = '';
});

// ---------------- Actions ----------------
function sauvegarder() {
  if (!enregistrerProjetsLocaux(projets)) {
    toast("Espace de stockage du navigateur plein : réduisez le nombre ou la taille des images.", 'err');
    return false;
  }
  majAlerte();
  return true;
}

document.getElementById('enregistrer').addEventListener('click', () => {
  if (!form.reportValidity()) return;
  const p = lireFormulaire();
  p.id = slug(p.id || p.titre);
  const conflit = projets.findIndex((x, i) => x.id === p.id && i !== indexCourant);
  if (conflit !== -1) { toast('Cet identifiant existe déjà, changez-le.', 'err'); return; }
  if (indexCourant === -1) { projets.push(structuredClone(p)); indexCourant = projets.length - 1; }
  else projets[indexCourant] = structuredClone(p);
  if (sauvegarder()) {
    champ('id').value = p.id; rendreListe(); toast(`« ${esc(p.titre)} » enregistré.`);
    journaliser('projet.enregistre', { ref: p.id, details: { titre: p.titre, statut: p.statut || 'en-vente', prixBase: p.prix, devise: CONFIG.devise } });
  }
});

document.getElementById('nouveau').addEventListener('click', () => {
  indexCourant = -1;
  courant = projetVierge();
  delete champ('id').dataset.touche;
  remplirFormulaire(courant);
  champ('id').value = '';
  rendreListe();
  majApercu(true);
  champ('titre').focus();
});

document.getElementById('dupliquer').addEventListener('click', () => {
  const p = structuredClone(lireFormulaire());
  p.titre += ' (copie)';
  p.id = slug(p.titre);
  projets.push(p);
  sauvegarder();
  selectionner(projets.length - 1);
  toast('Projet dupliqué.');
});

document.getElementById('supprimer').addEventListener('click', () => {
  if (indexCourant === -1) { selectionner(0); return; }
  if (!confirm(`Supprimer définitivement « ${projets[indexCourant].titre} » ?`)) return;
  const [supprime] = projets.splice(indexCourant, 1);
  sauvegarder();
  journaliser('projet.supprime', { ref: supprime.id, details: { titre: supprime.titre, prixBase: supprime.prix } });
  selectionner(Math.max(0, indexCourant - 1));
  toast('Projet supprimé.');
});

document.getElementById('voir').addEventListener('click', (e) => {
  if (indexCourant === -1) { e.preventDefault(); toast("Enregistrez d'abord le projet.", 'err'); return; }
  e.currentTarget.href = `projet.html?id=${encodeURIComponent(projets[indexCourant].id)}`;
});

// ---------------- Publication ----------------
document.getElementById('exporter').addEventListener('click', () => {
  telecharger('projets.json', projets.map(versionPublique));
  journaliser('catalogue.export', { details: { nombreProjets: projets.length, prix: projets.map((p) => `${p.id}=${p.prix}`).join(', ') } });
  toast('projets.json public téléchargé (sans les détails réservés).');
});

document.getElementById('importer').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data)) throw new Error();
    if (data.every((x) => x.id && x.prive && !x.modele)) {
      // sauvegarde des détails réservés : fusion par identifiant
      let n = 0;
      for (const d of data) { const p = projets.find((x) => x.id === d.id); if (p) { p.prive = d.prive; n++; } }
      toast(`Détails réservés restaurés pour ${n} projet(s).`);
    } else {
      const anciens = new Map(projets.map((p) => [p.id, p.prive]));
      projets = migrer(data).map((p) => (p.prive || !anciens.get(p.id) ? p : { ...p, prive: anciens.get(p.id) }));
      toast(`${data.length} projets importés.`);
    }
    sauvegarder();
    selectionner(Math.max(0, indexCourant));
  } catch { toast('Fichier JSON invalide.', 'err'); }
  e.target.value = '';
});

document.getElementById('reinitialiser').addEventListener('click', async () => {
  if (!confirm('Revenir à la version publiée (data/projets.json) ? Les modifications non exportées seront perdues (les détails réservés sont conservés).')) return;
  const anciens = new Map(projets.map((p) => [p.id, p.prive]));
  supprimerModificationsLocales();
  projets = migrer(structuredClone(await getProjets())).map((p) => ({ ...p, prive: p.prive || anciens.get(p.id) }));
  if ([...anciens.values()].some(Boolean)) sauvegarder();
  majAlerte();
  selectionner(0);
  toast('Version publiée restaurée.');
});

document.getElementById('exporterPrive').addEventListener('click', () => {
  const d = new Date().toISOString().slice(0, 10);
  telecharger(`kkg-details-reserves-${d}.json`, projets.filter((p) => p.prive).map((p) => ({ id: p.id, titre: p.titre, prive: p.prive })));
  toast('Sauvegarde privée téléchargée — gardez-la hors de GitHub.');
  journaliser('sauvegarde.privee', { details: { nombreProjets: projets.filter((p) => p.prive).length } });
});

// ---------------- Détails réservés ----------------
const CHAMPS_PRIVES_ANCIENS = ['pieces', 'dimensions'];

/** Déplace d'anciens champs publics (pièces, emprise) vers les détails réservés. */
function migrer(liste) {
  return liste.map((p) => {
    const q = { ...p, prive: { ...(p.prive || {}) } };
    for (const c of CHAMPS_PRIVES_ANCIENS) {
      if (q[c] !== undefined) {
        const vide = q[c] === '' || (Array.isArray(q[c]) && !q[c].length);
        if (!vide && !q.prive[c]?.length) q.prive[c] = q[c];
        delete q[c];
      }
    }
    if (!Object.values(q.prive).some((v) => (Array.isArray(v) ? v.length : v))) delete q.prive;
    return q;
  });
}

/** Ce qui est publié : tout sauf les détails réservés. */
function versionPublique(p) {
  const { prive, ...pub } = p;
  for (const c of CHAMPS_PRIVES_ANCIENS) delete pub[c];
  return pub;
}

function telecharger(nom, donnees) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.getElementById('ficheAcheteur').addEventListener('click', async () => {
  const p = lireFormulaire();
  const client = prompt('Nom du client acheteur (inscrit sur chaque page de la fiche) :', '');
  if (client === null) return;
  const telClient = prompt('Téléphone du client (pour le journal) :', '') || '';
  const ref = prompt('Référence de la commande ou du devis :', '') || '';
  const w = window.open('', '_blank');
  if (!w) { toast('Autorisez les fenêtres pop-up pour générer la fiche.', 'err'); return; }
  const trace = await journaliser('fiche.remise', {
    ref, client: { nom: client, telephone: telClient },
    details: { projet: p.id, titre: p.titre, document: 'Fiche acheteur confidentielle' },
  });
  const code = trace.hash.slice(0, 12).toUpperCase();
  const pr = p.prive || {};
  const e = CONFIG.entreprise;
  const lignes = (arr) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche acheteur — ${esc(p.titre)}</title>
<style>
  body{font:14px/1.55 Georgia,serif;color:#222;max-width:800px;margin:30px auto;padding:0 24px}
  h1{font-size:28px;margin:0} h2{font-size:17px;border-bottom:2px solid #b8894d;padding-bottom:4px;margin-top:28px;color:#6d4a2f}
  .entete{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #222;padding-bottom:10px;margin-bottom:18px}
  .conf{background:#f6efe3;border:1px solid #b8894d;padding:10px 14px;font-size:12.5px}
  table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left} td:last-child,th:last-child{text-align:right}
  .grille{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
  .pied{position:fixed;bottom:8px;left:0;right:0;text-align:center;font-size:10px;color:#777}
  pre{white-space:pre-wrap;font:inherit}
  @media print{.noprint{display:none} body{margin:0}}
</style></head><body>
<div class="noprint" style="text-align:right;margin-bottom:12px"><button onclick="print()">Imprimer / enregistrer en PDF</button></div>
<div class="entete"><div><small>${esc(e.raisonSociale)}</small><h1>${esc(p.titre)}</h1><small>${esc(p.style || '')}</small></div>
<div style="text-align:right;font-size:12px">Fiche acheteur<br>${ref ? `Réf. ${esc(ref)}<br>` : ''}${new Date().toLocaleDateString('fr-FR')}</div></div>
<div class="conf"><b>Document confidentiel</b>, remis à <b>${esc(client || '—')}</b> après paiement. Il est protégé par le droit d'auteur et ne peut servir qu'à la construction autorisée par la licence achetée. Toute diffusion, copie ou réutilisation est interdite (voir les conditions de la licence).</div>
<h2>Chiffres clés</h2><div class="grille">
<div>Surface habitable : <b>${esc(p.surface)} m²</b></div><div>Niveaux : <b>${p.etages > 1 ? 'R+' + (p.etages - 1) : 'Plain-pied'}</b></div>
<div>Chambres : <b>${esc(p.chambres)}</b></div><div>Salles de bain : <b>${esc(p.sallesDeBain)}</b></div>
${pr.dimensions ? `<div>Emprise : <b>${esc(pr.dimensions)}</b></div>` : ''}${pr.hauteur ? `<div>Hauteur totale : <b>${esc(pr.hauteur)}</b></div>` : ''}
${p.terrain ? `<div>Terrain : <b>${esc(p.terrain)}</b></div>` : ''}${p.budgetEstime ? `<div>Budget estimé (indicatif) : <b>${esc(p.budgetEstime)}</b></div>` : ''}
</div>
${pr.descriptionArchitecturale ? `<h2>Description architecturale</h2><pre>${esc(pr.descriptionArchitecturale)}</pre>` : ''}
${pr.pieces?.length ? `<h2>Tableau des surfaces</h2><table><tr><th>Pièce</th><th>Surface</th></tr>${pr.pieces.map((x) => `<tr><td>${esc(x.nom)}</td><td>${esc(x.surface)} m²</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${pr.pieces.reduce((t, x) => t + (+x.surface || 0), 0)} m²</b></td></tr></table>` : ''}
${pr.notesTechniques ? `<h2>Notes techniques</h2><pre>${esc(pr.notesTechniques)}</pre>` : ''}
${p.caracteristiques?.length ? `<h2>Points forts</h2><ul>${lignes(p.caracteristiques)}</ul>` : ''}
${p.inclus?.length ? `<h2>Contenu du dossier remis</h2><ul>${lignes(p.inclus)}</ul>` : ''}
<h2>Avertissement</h2><p style="font-size:12.5px">Les plans sont des documents de conception architecturale. Avant tout commencement des travaux, faites réaliser une étude de sol et le calcul de la structure par un ingénieur qualifié. Obtenez les autorisations nécessaires, avec la signature d'un professionnel agréé si la réglementation locale l'exige. Le budget estimé est indicatif.</p>
<p style="font-size:11px;color:#666;margin-top:24px">Code de traçabilité : <b>${code}</b> — journal n° ${trace.n} du ${new Date(trace.date).toLocaleString('fr-FR')}</p>
<div class="pied">${esc(e.raisonSociale)} — Document confidentiel remis à ${esc(client || '—')}${ref ? ` — ${esc(ref)}` : ''} — traçabilité ${code} — reproduction interdite</div>
</body></html>`;
  w.document.write(html);
  w.document.close();
});

// ---------------- Commandes ----------------
function rendreCommandes() {
  const cmds = getCommandes();
  const t = document.getElementById('tabCommandes');
  if (!cmds.length) { t.innerHTML = '<tr><td class="muted">Aucune commande pour le moment.</td></tr>'; return; }
  t.innerHTML = `<tr><th>Réf.</th><th>Date</th><th>Client</th><th>Projets</th><th>Paiement</th><th>Statut</th><th>Total</th></tr>` +
    cmds.map((c) => `
      <tr>
        <td><span class="ref">${esc(c.ref)}</span></td>
        <td>${new Date(c.date).toLocaleString('fr-FR')}</td>
        <td>${esc(c.client.nom)}<br><span class="muted" style="font-size:.8rem">${esc(c.client.email)}<br>${esc(c.client.telephone)}</span></td>
        <td>${c.articles.map((a) => `${esc(a.titre)} <span class="muted">(${esc(a.licence)})</span>`).join('<br>')}</td>
        <td>${esc(c.methode)}</td>
        <td><select class="champ" data-ref="${esc(c.ref)}" style="padding:.3em .5em">
          ${['en attente', 'payée', 'livrée', 'annulée'].map((s) => `<option ${s === c.statut ? 'selected' : ''}>${s}</option>`).join('')}
        </select></td>
        <td><b>${formatPrix(c.total)}</b></td>
      </tr>`).join('');
}
document.getElementById('tabCommandes').addEventListener('change', (e) => {
  const s = e.target.closest('[data-ref]');
  if (!s) return;
  const c = getCommandes().find((x) => x.ref === s.dataset.ref);
  const changes = { statut: s.value };
  if (s.value === 'payée') {
    changes.transaction = prompt('N° de transaction (Mobile Money, virement…) :', c?.transaction || '') || '';
    changes.montantRecu = prompt('Montant effectivement reçu :', c?.montantRecu || String(c?.total ?? '')) || '';
  }
  majCommande(s.dataset.ref, changes);
  journaliser(s.value === 'payée' ? 'commande.paiement' : 'commande.statut', {
    ref: s.dataset.ref, client: c?.client,
    details: { avant: c?.statut || '', apres: s.value, total: c?.total, methode: c?.methode, transaction: changes.transaction, montantRecu: changes.montantRecu },
  });
  toast('Statut mis à jour et journalisé.');
});
document.getElementById('exportCSV').addEventListener('click', () => {
  const lignes = [['reference', 'date', 'nom', 'email', 'telephone', 'pays', 'projets', 'paiement', 'statut', 'total']];
  for (const c of getCommandes()) {
    lignes.push([c.ref, c.date, c.client.nom, c.client.email, c.client.telephone, c.client.pays,
      c.articles.map((a) => `${a.titre} (${a.licence})`).join(' | '), c.methode, c.statut, c.total]);
  }
  const csv = lignes.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = 'commandes.csv';
  a.click();
});


// ---------------- Requêtes (boîte aux requêtes en ligne) ----------------
const CLE_JETON = 'kkg_jeton_agent';
const URL_AGENT = (CONFIG.agentIA || '').replace(/\/$/, '');
const LIBELLE_TYPE = { 'sur-mesure': 'Sur mesure', adaptation: 'Adaptation', question: 'Question', reclamation: 'Réclamation', commande: 'Commande' };
const STATUTS = ['nouvelle', 'en cours', 'devis envoyé', 'acompte reçu', 'terminée', 'sans suite', 'en attente', 'payée', 'livrée'];
let requetesCache = [];

async function chargerRequetes() {
  if (!URL_AGENT) return { distantes: null, message: "Boîte aux requêtes en ligne non configurée (champ <code>agentIA</code> de <code>js/config.js</code>) : seules les requêtes déposées depuis <b>ce navigateur</b> s'affichent. Les clients doivent donc aussi vous écrire sur WhatsApp." };
  let jeton = sessionStorage.getItem(CLE_JETON);
  if (!jeton) {
    jeton = prompt("Jeton d'accès à la boîte aux requêtes (ADMIN_TOKEN de l'agent) :") || '';
    if (!jeton) return { distantes: null, message: 'Jeton non fourni.' };
    sessionStorage.setItem(CLE_JETON, jeton);
  }
  try {
    const r = await fetch(`${URL_AGENT}/requetes`, { headers: { Authorization: `Bearer ${jeton}` } });
    if (r.status === 401) { sessionStorage.removeItem(CLE_JETON); return { distantes: null, message: 'Jeton refusé. Cliquez sur « Actualiser » pour réessayer.' }; }
    if (!r.ok) throw new Error(r.status);
    return { distantes: await r.json(), message: '' };
  } catch (e) {
    return { distantes: null, message: `Impossible de joindre la boîte aux requêtes (${esc(e.message)}).` };
  }
}

async function rendreRequetes() {
  const zone = document.getElementById('listeRequetes');
  zone.innerHTML = '<p class="muted">Chargement…</p>';
  const { distantes, message } = await chargerRequetes();
  document.getElementById('oublierJeton').hidden = !URL_AGENT;
  const alerte = document.getElementById('alerteRequetes');
  alerte.hidden = !message;
  alerte.innerHTML = message;
  requetesCache = distantes || getRequetesLocales().map((r) => ({ ...r, locale: true }));
  afficherRequetes();
}

function afficherRequetes() {
  const filtre = document.getElementById('filtreRequetes').value;
  const liste = requetesCache.filter((r) => !filtre || r.statut === filtre);
  const zone = document.getElementById('listeRequetes');
  if (!liste.length) { zone.innerHTML = '<div class="vide">Aucune requête.</div>'; return; }
  zone.innerHTML = liste.map((r, i) => {
    const c = r.client || {};
    const b = r.besoin || {};
    const details = [
      r.projetReference && `<b>Plan :</b> ${esc(r.projetReference.titre || r.projetReference.id)}`,
      c.lieu && `<b>Lieu :</b> ${esc(c.lieu)}`,
      ...Object.entries(b).filter(([, v]) => v).map(([k, v]) => `<b>${esc(k)} :</b> ${esc(v)}`),
      r.articles && `<b>Articles :</b> ${r.articles.map((a) => `${esc(a.titre)} (${esc(a.licence)}) ${formatPrix(a.prix)}`).join(', ')} — <b>Total :</b> ${formatPrix(r.total)} — <b>Paiement :</b> ${esc(r.methode)}`,
      r.resume && `<b>Résumé :</b> ${esc(r.resume)}`,
    ].filter(Boolean).join('<br>');
    return `
      <details class="encart requete">
        <summary>
          <span class="ref">${esc(r.ref || '—')}</span>
          <span class="statut">${esc(LIBELLE_TYPE[r.type] || r.type)}</span>
          <b>${esc(c.nom || 'Sans nom')}</b>
          <span class="muted">${new Date(r.recueLe || r.date).toLocaleString('fr-FR')}</span>
          <span class="statut ${r.statut === 'nouvelle' ? 'payee' : ''}">${esc(r.statut || '')}</span>
        </summary>
        <div style="margin-top:1rem">
          <p>${c.telephone ? `📞 ${esc(c.telephone)} · <a href="https://wa.me/${numeroInternational(c.telephone)}?text=${encodeURIComponent(`Bonjour ${c.nom || ''}, concernant votre demande ${r.ref} :`)}" target="_blank" rel="noopener" style="color:var(--or)">Répondre sur WhatsApp</a>` : ''}
            ${c.email ? ` · ✉ <a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Votre demande ' + (r.ref || ''))}" style="color:var(--or)">${esc(c.email)}</a>` : ''}</p>
          ${details ? `<p>${details}</p>` : ''}
          ${r.description ? `<p style="white-space:pre-wrap">${esc(r.description)}</p>` : ''}
          ${r.conversation ? `<details><summary class="muted">Conversation avec l'assistant</summary><pre style="white-space:pre-wrap;font-size:.8rem" class="muted">${esc(r.conversation)}</pre></details>` : ''}
          ${r.locale ? '' : `
          <div class="form-grille" style="margin-top:1rem">
            <div><label class="etiquette">Statut</label><select class="champ" data-statut="${i}">${STATUTS.map((s) => `<option ${s === r.statut ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            ${r.type === 'commande' ? `
            <div><label class="etiquette">N° de transaction</label><input class="champ" data-transaction="${i}" value="${esc(r.transaction || '')}"></div>
            <div><label class="etiquette">Montant reçu</label><input class="champ" data-montant="${i}" value="${esc(r.montantRecu || '')}"></div>
            <div><label class="etiquette">Canal de livraison</label><input class="champ" data-canal="${i}" value="${esc(r.canalLivraison || '')}" placeholder="e-mail, WhatsApp…"></div>` : ''}
            <div class="plein"><label class="etiquette">Note interne</label><textarea class="champ" rows="2" data-note="${i}">${esc(r.note || '')}</textarea></div>
            <div><button class="btn discret" data-maj="${i}">Enregistrer</button></div>
          </div>`}
        </div>
      </details>`;
  }).join('');
  zone.dataset.filtre = filtre;
}

document.getElementById('listeRequetes').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-maj]');
  if (!b) return;
  const i = +b.dataset.maj;
  const filtre = document.getElementById('filtreRequetes').value;
  const r = requetesCache.filter((x) => !filtre || x.statut === filtre)[i];
  const statut = document.querySelector(`[data-statut="${i}"]`).value;
  const note = document.querySelector(`[data-note="${i}"]`).value;
  const val = (a) => document.querySelector(`[data-${a}="${i}"]`)?.value;
  const extra = r.type === 'commande' ? { transaction: val('transaction') || '', montantRecu: val('montant') || '', canalLivraison: val('canal') || '' } : {};
  const rep = await fetch(`${URL_AGENT}/requetes/${encodeURIComponent(r.cle)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(CLE_JETON)}` },
    body: JSON.stringify({ statut, note, ...extra }),
  }).catch(() => null);
  if (rep?.ok) { Object.assign(r, { statut, note, ...extra }); toast('Requête mise à jour et journalisée.'); } else toast('Échec de la mise à jour.', 'err');
});
document.getElementById('rafraichirRequetes').addEventListener('click', rendreRequetes);
document.getElementById('filtreRequetes').addEventListener('change', afficherRequetes);
document.getElementById('oublierJeton').addEventListener('click', () => { sessionStorage.removeItem(CLE_JETON); rendreRequetes(); });

function numeroInternational(tel) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  else if (n.startsWith('0')) n = `243${n.slice(1)}`; // numéro local RDC
  return n;
}
