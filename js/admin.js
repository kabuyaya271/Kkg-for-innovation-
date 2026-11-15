import { CONFIG } from './config.js';
import {
  getProjets, enregistrerProjetsLocaux, aDesModificationsLocales, supprimerModificationsLocales,
  getCommandes, majCommande, formatPrix, prixLicence, getRequetesLocales,
} from './store.js';
import { initialiserPage, esc, toast } from './ui.js';
import { Visionneuse } from './viewer.js';
import { MODELE_DEFAUT } from './builder3d.js';

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
    delaiConstruction: '', vedette: false, nouveau: true, caracteristiques: [], pieces: [], inclus: [
      'Plans de chaque niveau cotés (1/50)', 'Façades et coupes', 'Plan de toiture', 'Plan de fondations',
    ],
    modele: { ...MODELE_DEFAUT, etages: 1 }, modeleGLB: '', images: [], lienPaiement: '',
  };
}

async function ouvrir() {
  connexion.hidden = true;
  document.getElementById('espace').hidden = false;
  projets = structuredClone(await getProjets());
  apercu = new Visionneuse(document.getElementById('apercu3d'), { rotationAuto: false });
  majAlerte();
  rendreListe();
  selectionner(0);
  rendreCommandes();
  rendreRequetes();
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
    const [a, b] = el.name.startsWith('m.') ? ['modele', el.name.slice(2)] : [el.name];
    let v = b ? p.modele?.[b] ?? MODELE_DEFAUT[b] : p[a];
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
    if (el.name === 'pieces') {
      v = v.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = /^(.*?)[\s:;–-]+(\d+(?:[.,]\d+)?)\s*(m²|m2)?$/i.exec(l);
        return m ? { nom: m[1].trim(), surface: +m[2].replace(',', '.') } : { nom: l, surface: '' };
      });
    }
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
  if (sauvegarder()) { champ('id').value = p.id; rendreListe(); toast(`« ${esc(p.titre)} » enregistré.`); }
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
  projets.splice(indexCourant, 1);
  sauvegarder();
  selectionner(Math.max(0, indexCourant - 1));
  toast('Projet supprimé.');
});

document.getElementById('voir').addEventListener('click', (e) => {
  if (indexCourant === -1) { e.preventDefault(); toast("Enregistrez d'abord le projet.", 'err'); return; }
  e.currentTarget.href = `projet.html?id=${encodeURIComponent(projets[indexCourant].id)}`;
});

// ---------------- Publication ----------------
document.getElementById('exporter').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(projets, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'projets.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

document.getElementById('importer').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data)) throw new Error();
    projets = data;
    sauvegarder();
    selectionner(0);
    toast(`${data.length} projets importés.`);
  } catch { toast('Fichier JSON invalide.', 'err'); }
  e.target.value = '';
});

document.getElementById('reinitialiser').addEventListener('click', async () => {
  if (!confirm('Revenir à la version publiée (data/projets.json) ? Les modifications non exportées seront perdues.')) return;
  supprimerModificationsLocales();
  projets = structuredClone(await getProjets());
  majAlerte();
  selectionner(0);
  toast('Version publiée restaurée.');
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
  if (s) { majCommande(s.dataset.ref, { statut: s.value }); toast('Statut mis à jour.'); }
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
  const rep = await fetch(`${URL_AGENT}/requetes/${encodeURIComponent(r.cle)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(CLE_JETON)}` },
    body: JSON.stringify({ statut, note }),
  }).catch(() => null);
  if (rep?.ok) { Object.assign(r, { statut, note }); toast('Requête mise à jour.'); } else toast('Échec de la mise à jour.', 'err');
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
