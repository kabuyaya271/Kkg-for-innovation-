// Atelier de conception KKG — application principale
import { CONFIG } from '../config.js';
import { getProjets, enregistrerProjetsLocaux } from '../store.js';
import { journaliser } from '../journal.js';
import { Visionneuse } from '../viewer.js?v=7';
import {
  nouvelleEtude, nouveauNiveau, uid, longueur, aire, metreEtude, resumePourAgents, niveauDepuisProposition,
  fmt, PRIX_DEFAUT, ouvertureValide,
} from './modele.js';
import { Editeur, OUTILS } from './editeur.js';
import { construireEtude3D, exporterGLB } from './vue3d.js';
import { exporterDXF, planche, versCatalogue, telecharger, nomFichier } from './exports.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const API = (CONFIG.agentIA || '').replace(/\/$/, '');
const CLE_CODE = 'kkg_poste_code';
const LS_ETUDES = 'kkg_etudes';

const etat = {
  poste: null, enLigne: false, etude: null, niveau: 0,
  passe: [], futur: [], modifie: false, vue3d: null, maj3d: null, agent: 'architecte', conversations: {},
};

function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `atelier-toast ${type}`;
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

async function api(chemin, options = {}) {
  const r = await fetch(`${API}/studio${chemin}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(CLE_CODE)}`, ...(options.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.erreur || `Erreur ${r.status}`), { status: r.status });
  return data;
}

// =====================================================================
//  Connexion
// =====================================================================
async function connexion() {
  const ecran = $('#connexion');
  if (!API) {
    $('#cxMessage').innerHTML = "Le serveur de l'atelier (<code>agentIA</code>) n'est pas encore configuré : vous pouvez travailler <b>hors ligne</b>. Les études restent sur cet ordinateur, sans agents IA ni partage.";
    $('#cxCode').hidden = true; $('#cxEntrer').hidden = true;
  }
  const entrer = async (code) => {
    sessionStorage.setItem(CLE_CODE, code);
    try {
      const { poste } = await api('/connexion', { method: 'POST' });
      etat.poste = poste; etat.enLigne = true;
      ecran.hidden = true; demarrer();
    } catch (e) {
      sessionStorage.removeItem(CLE_CODE);
      $('#cxErreur').textContent = e.message;
    }
  };
  $('#cxForm').addEventListener('submit', (e) => { e.preventDefault(); const c = $('#cxCode').value.trim(); if (c) entrer(c); });
  $('#cxLocal').addEventListener('click', () => {
    etat.poste = { id: 'local', nom: 'Poste local', role: 'directeur' }; etat.enLigne = false;
    ecran.hidden = true; demarrer();
  });
  const memo = sessionStorage.getItem(CLE_CODE);
  if (API && memo) entrer(memo);
}

// =====================================================================
//  Études
// =====================================================================
const etudesLocales = () => { try { return JSON.parse(localStorage.getItem(LS_ETUDES)) || {}; } catch { return {}; } };

async function listeEtudes() {
  if (etat.enLigne) return api('/etudes');
  return Object.values(etudesLocales()).map((e) => ({ id: e.id, nom: e.nom, client: e.client, modifieLe: e.modifieLe, modifiePar: e.modifiePar, niveaux: e.niveaux.length }))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)));
}

async function ouvrirEtude(id) {
  const e = etat.enLigne ? await api(`/etudes/${id}`) : etudesLocales()[id];
  if (!e) { toast('Étude introuvable.', 'err'); return; }
  const brouillon = localStorage.getItem(`kkg_brouillon_${id}`);
  if (brouillon) {
    const b = JSON.parse(brouillon);
    if (b.version === e.version && b.modifieLocal && confirm('Des modifications non enregistrées de cette étude existent sur ce poste. Les récupérer ?')) {
      chargerEtude(b, true); return;
    }
  }
  chargerEtude(e, false);
}

function chargerEtude(e, modifie) {
  e.prix = { ...PRIX_DEFAUT, ...(e.prix || {}) };
  etat.etude = e; etat.niveau = 0; etat.passe = []; etat.futur = []; etat.modifie = modifie;
  etat.conversations = {};
  editeur.calque = e.calque || null;
  editeur.selectionner(null);
  rafraichirTout();
  setTimeout(() => editeur.cadrer(), 50);
  fermerModale();
}

async function enregistrer() {
  const e = etat.etude;
  if (!e) return;
  const btn = $('#btnEnregistrer');
  btn.disabled = true;
  try {
    if (etat.enLigne) {
      const r = await api(`/etudes/${e.id}`, { method: 'PUT', body: JSON.stringify({ etude: e, version: e.version || undefined }) });
      e.version = r.version; e.modifieLe = r.modifieLe; e.modifiePar = etat.poste.nom;
    } else {
      e.version = (e.version || 0) + 1; e.modifieLe = new Date().toISOString(); e.modifiePar = etat.poste.nom;
      const toutes = etudesLocales(); toutes[e.id] = e;
      localStorage.setItem(LS_ETUDES, JSON.stringify(toutes));
      journaliser('etude.enregistree', { ref: e.id, details: { nom: e.nom, version: e.version, poste: etat.poste.nom } });
    }
    etat.modifie = false;
    localStorage.removeItem(`kkg_brouillon_${e.id}`);
    toast(`Étude enregistrée (version ${e.version}).`);
  } catch (err) {
    toast(esc(err.message), 'err');
  } finally { btn.disabled = false; majEntete(); }
}

function brouillon() {
  if (!etat.etude) return;
  try { localStorage.setItem(`kkg_brouillon_${etat.etude.id}`, JSON.stringify({ ...etat.etude, modifieLocal: true })); } catch { /* plein */ }
}

// =====================================================================
//  Annuler / rétablir
// =====================================================================
const instantane = () => JSON.stringify({ niveaux: etat.etude.niveaux, niveau: etat.niveau });

function commit(fn) {
  etat.passe.push(instantane());
  if (etat.passe.length > 200) etat.passe.shift();
  etat.futur = [];
  fn();
  changement(true);
}

function restaurer(json) {
  const s = JSON.parse(json);
  etat.etude.niveaux = s.niveaux; etat.niveau = Math.min(s.niveau, s.niveaux.length - 1);
  editeur.selectionner(null);
  changement(true); majNiveaux();
}
function annuler() { if (!etat.passe.length) return; etat.futur.push(instantane()); restaurer(etat.passe.pop()); }
function retablir() { if (!etat.futur.length) return; etat.passe.push(instantane()); restaurer(etat.futur.pop()); }

function changement(complet = true) {
  etat.modifie = true;
  majEntete();
  if (complet) {
    editeur.rendre();
    afficherProprietes();
    planifier3D();
    if (!$('#pMetre').hidden) afficherMetre();
    clearTimeout(etat.minBrouillon);
    etat.minBrouillon = setTimeout(brouillon, 800);
  }
}

// =====================================================================
//  Éditeur
// =====================================================================
const niveauCourant = () => etat.etude?.niveaux[etat.niveau];
const editeur = new Editeur($('#plan'), {
  niveau: niveauCourant,
  niveauDessous: () => (etat.niveau > 0 ? etat.etude.niveaux[etat.niveau - 1] : null),
  etude: () => etat.etude,
  commit,
  changement,
  selection: () => afficherProprietes(),
  statut: (s) => {
    $('#stOutil').textContent = s.outil;
    $('#stAide').textContent = s.extra || s.aide;
    $('#stPos').textContent = s.pos;
    $('#stMesure').textContent = s.mesure;
    $('#stSaisie').textContent = s.saisie ? `Saisie : ${s.saisie}` : '';
    $('#stAccroche').textContent = s.accroche ? `◆ ${s.accroche}` : '';
  },
  nom: (defaut) => prompt('Nom de la pièce :', defaut),
});

function construirePalette() {
  $('#palette').innerHTML = Object.entries(OUTILS).map(([k, o]) =>
    `<button data-outil="${k}" title="${esc(o.nom)} (${o.touche})"><span class="ic ic-${k}"></span><small>${esc(o.nom.split(' ')[0])}</small></button>`).join('');
  $('#palette').addEventListener('click', (e) => { const b = e.target.closest('[data-outil]'); if (b) choisirOutil(b.dataset.outil); });
}
function choisirOutil(o) {
  editeur.setOutil(o);
  document.querySelectorAll('#palette [data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === o));
  afficherProprietes();
}

document.addEventListener('keydown', (ev) => {
  if (!etat.etude || !$('#modale').hidden) return;
  const saisieTexte = ev.target.closest('input, textarea, select');
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); enregistrer(); return; }
  if (saisieTexte) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? retablir() : annuler(); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); retablir(); return; }
  if (ev.key === ' ') { editeur.espace = true; ev.preventDefault(); return; }
  if (editeur.touche(ev)) { ev.preventDefault(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { editeur.supprimer(); ev.preventDefault(); return; }
  if (ev.key === 'F8') { ev.preventDefault(); basculer('ortho'); return; }
  if (ev.key === 'F9') { ev.preventDefault(); basculer('aimant'); return; }
  if (ev.key.toLowerCase() === 'z' && !ev.ctrlKey) { editeur.cadrer(); return; }
  const o = Object.entries(OUTILS).find(([, v]) => v.touche.toLowerCase() === ev.key.toLowerCase());
  if (o && !ev.ctrlKey && !ev.metaKey) choisirOutil(o[0]);
});
document.addEventListener('keyup', (ev) => { if (ev.key === ' ') editeur.espace = false; });

function basculer(quoi) {
  editeur[quoi] = !editeur[quoi];
  $(`#bt-${quoi}`).classList.toggle('actif', editeur[quoi]);
}

// =====================================================================
//  En-tête, niveaux
// =====================================================================
function majEntete() {
  const e = etat.etude;
  $('#nomEtude').value = e?.nom || '';
  $('#etatSauvegarde').textContent = !e ? '' : etat.modifie ? '● Non enregistré' : `✓ Enregistré${e.version ? ` (v${e.version})` : ''}`;
  $('#etatSauvegarde').className = etat.modifie ? 'non-enregistre' : '';
  $('#posteNom').textContent = `${etat.poste.nom}${etat.enLigne ? '' : ' · hors ligne'}`;
}

function majNiveaux() {
  $('#niveau').innerHTML = etat.etude.niveaux.map((n, i) => `<option value="${i}" ${i === etat.niveau ? 'selected' : ''}>${esc(n.nom)}</option>`).join('');
}

function rafraichirTout() {
  majEntete(); majNiveaux(); editeur.rendre(); afficherProprietes(); planifier3D();
  if (!$('#pMetre').hidden) afficherMetre();
}

// =====================================================================
//  Panneau Propriétés
// =====================================================================
const champ = (label, html) => `<label class="pr"><span>${label}</span>${html}</label>`;
const num = (k, v, pas = 0.01, min = '') => `<input type="number" data-k="${k}" value="${Math.round(v * 1000) / 1000}" step="${pas}" ${min !== '' ? `min="${min}"` : ''}>`;

function afficherProprietes() {
  const z = $('#pProps');
  if (!etat.etude) return;
  const sel = editeur.sel, el = editeur.element();
  const n = niveauCourant();
  let h = '';
  if (el && sel.type === 'mur') {
    h = `<h4>Mur ${el.exterieur ? 'extérieur' : 'intérieur'}</h4>
      ${champ('Longueur (m)', num('longueur', longueur(el), 0.01, 0.05))}
      ${champ('Épaisseur (m)', num('epaisseur', el.epaisseur, 0.01, 0.05))}
      ${champ('Mur extérieur', `<input type="checkbox" data-k="exterieur" ${el.exterieur ? 'checked' : ''}>`)}
      <div class="pr-grille">${champ('X1', num('x1', el.x1))}${champ('Y1', num('y1', el.y1))}${champ('X2', num('x2', el.x2))}${champ('Y2', num('y2', el.y2))}</div>`;
  } else if (el && sel.type === 'ouverture') {
    h = `<h4>${{ porte: 'Porte', fenetre: 'Fenêtre', baie: 'Baie vitrée' }[el.type]}</h4>
      ${champ('Type', `<select data-k="type">${['porte', 'fenetre', 'baie'].map((t) => `<option ${t === el.type ? 'selected' : ''} value="${t}">${t}</option>`).join('')}</select>`)}
      ${champ('Largeur (m)', num('largeur', el.largeur, 0.05, 0.3))}${champ('Hauteur (m)', num('hauteur', el.hauteur, 0.05, 0.3))}
      ${champ('Allège (m)', num('allege', el.allege, 0.05, 0))}${champ('Position du centre sur le mur (m)', num('position', el.position, 0.05, 0))}
      <p class="aide-pr">Glissez l'ouverture le long du mur pour la déplacer.</p>`;
  } else if (el && sel.type === 'piece') {
    let per = 0; for (let i = 0; i < el.points.length; i++) { const a = el.points[i], b = el.points[(i + 1) % el.points.length]; per += Math.hypot(b.x - a.x, b.y - a.y); }
    h = `<h4>Pièce</h4>${champ('Nom', `<input data-k="nom" value="${esc(el.nom)}">`)}
      <p class="mesure-pr">Surface : <b>${fmt(aire(el.points))} m²</b><br>Périmètre : ${fmt(per)} m<br>${el.points.length} sommets</p>
      <p class="aide-pr">Glissez les sommets pour ajuster la pièce.</p>`;
  } else if (el && sel.type === 'cote') {
    h = `<h4>Cote</h4><p class="mesure-pr">Longueur : <b>${fmt(Math.hypot(el.x2 - el.x1, el.y2 - el.y1))} m</b></p>${champ('Décalage (m)', num('decalage', el.decalage, 0.1))}`;
  } else if (el && sel.type === 'texte') {
    h = `<h4>Texte</h4>${champ('Texte', `<input data-k="texte" value="${esc(el.texte)}">`)}${champ('Taille (m)', num('taille', el.taille, 0.05, 0.1))}`;
  }
  if (el) h += `<button class="bt-danger" id="prSuppr">Supprimer (Suppr)</button>`;
  else {
    const d = editeur.defauts;
    const e = etat.etude;
    h = `<h4>Outil : ${esc(OUTILS[editeur.outil].nom)}</h4><p class="aide-pr">${esc(OUTILS[editeur.outil].aide)}</p>
      <h4>Murs à tracer</h4>${champ('Épaisseur (m)', `<input type="number" step="0.01" min="0.05" data-d="epaisseur" value="${d.epaisseur}">`)}
      ${champ('Extérieur', `<input type="checkbox" data-d="exterieur" ${d.exterieur ? 'checked' : ''}>`)}
      <h4>Ouvertures (largeur × hauteur, allège)</h4>
      ${['porte', 'fenetre', 'baie'].map((t) => `<div class="pr-grille3"><span>${t}</span><input type="number" step="0.05" data-o="${t}.largeur" value="${d[t].largeur}"><input type="number" step="0.05" data-o="${t}.hauteur" value="${d[t].hauteur}"><input type="number" step="0.05" data-o="${t}.allege" value="${d[t].allege}"></div>`).join('')}
      <h4>Niveau « ${esc(n.nom)} »</h4>${champ('Nom', `<input data-n="nom" value="${esc(n.nom)}">`)}${champ('Hauteur d\'étage (m)', `<input type="number" step="0.05" min="2.2" data-n="hauteur" value="${n.hauteur}">`)}
      <h4>Étude</h4>${champ('Client', `<input data-e="client" value="${esc(e.client)}">`)}${champ('Lieu', `<input data-e="lieu" value="${esc(e.lieu)}">`)}
      ${champ('Type', `<select data-e="typeBatiment">${['Maison', 'Villa', 'Duplex', 'Immeuble', 'Commercial', 'Équipement'].map((t) => `<option ${t === e.typeBatiment ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${champ('Toiture', `<select data-e="toit">${[['plat', 'Toit plat'], ['deux-pans', 'Deux pans'], ['quatre-pans', 'Quatre pans']].map(([v, l]) => `<option value="${v}" ${v === e.toit ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      <h4>Calque de fond (plan scanné, croquis)</h4>
      <input type="file" accept="image/*" id="calqueFichier">
      ${editeur.calque ? `${champ('Largeur réelle (m)', `<input type="number" step="0.1" data-c="largeur" value="${editeur.calque.largeur}">`)}${champ('Opacité', `<input type="range" min="0.05" max="1" step="0.05" data-c="opacite" value="${editeur.calque.opacite}">`)}<div class="pr-grille">${champ('X', `<input type="number" step="0.1" data-c="x" value="${editeur.calque.x || 0}">`)}${champ('Y', `<input type="number" step="0.1" data-c="y" value="${editeur.calque.y || 0}">`)}</div><button id="calqueRetirer">Retirer le calque</button>` : ''}
      <h4>Raccourcis</h4><p class="aide-pr">V sélection · M mur · R rectangle · P porte · F fenêtre · B baie · A pièce · C cote · T texte · E effacer · H vue · Z cadrer · F8 ortho · F9 aimant · Ctrl+Z / Ctrl+Y · Ctrl+S · Suppr · Échap · molette = zoom · Espace + glisser = déplacer</p>`;
  }
  z.innerHTML = h;
  $('#prSuppr')?.addEventListener('click', () => editeur.supprimer());
}

$('#pProps').addEventListener('change', async (ev) => {
  const t = ev.target;
  const val = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? Number(t.value) : t.value;
  if (t.dataset.d) { editeur.defauts[t.dataset.d] = val; return; }
  if (t.dataset.o) { const [a, b] = t.dataset.o.split('.'); editeur.defauts[a][b] = val; return; }
  if (t.dataset.n) { commit(() => { niveauCourant()[t.dataset.n] = val; }); majNiveaux(); return; }
  if (t.dataset.e) { commit(() => { etat.etude[t.dataset.e] = val; }); return; }
  if (t.dataset.c) { editeur.calque[t.dataset.c] = val; etat.etude.calque = editeur.calque; editeur.rendre(); return; }
  if (t.id === 'calqueFichier' && t.files[0]) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      editeur.calque = { src: lecteur.result, largeur: Number(prompt('Largeur réelle représentée par l\'image (en mètres) :', '20')) || 20, opacite: 0.4, x: 0, y: 0 };
      etat.etude.calque = editeur.calque;
      editeur.rendre(); afficherProprietes();
    };
    lecteur.readAsDataURL(t.files[0]);
    return;
  }
  const k = t.dataset.k; if (!k) return;
  const el = editeur.element(); const n = niveauCourant();
  if (editeur.sel.type === 'mur' && k === 'longueur') {
    const L = longueur(el); if (!(val > 0.04)) return;
    commit(() => { el.x2 = el.x1 + ((el.x2 - el.x1) / L) * val; el.y2 = el.y1 + ((el.y2 - el.y1) / L) * val; });
  } else if (editeur.sel.type === 'ouverture' && ['largeur', 'position'].includes(k)) {
    const mur = n.murs.find((w) => w.id === el.murId);
    const pos = k === 'position' ? val : el.position, larg = k === 'largeur' ? val : el.largeur;
    if (!ouvertureValide(n, mur, pos, larg, el.id)) { toast("L'ouverture ne tient pas à cet endroit du mur.", 'err'); afficherProprietes(); return; }
    commit(() => { el[k] = val; });
  } else {
    commit(() => { el[k] = val; if (k === 'type' && val === 'porte') el.allege = 0; });
  }
});
$('#pProps').addEventListener('click', (ev) => {
  if (ev.target.id === 'calqueRetirer') { editeur.calque = null; delete etat.etude.calque; editeur.rendre(); afficherProprietes(); }
});

// =====================================================================
//  3D
// =====================================================================
function planifier3D() {
  if ($('#p3d').hidden || !etat.etude) return;
  clearTimeout(etat.maj3d);
  etat.maj3d = setTimeout(maj3D, 250);
}
function maj3D() {
  if (!etat.vue3d) etat.vue3d = new Visionneuse($('#vue3d'));
  const premier = !etat.vue3d.modele;
  etat.vue3d.afficherObjet(construireEtude3D(etat.etude), { garderVue: !premier });
  etat.vue3d.definirEclatement(Number($('#eclat3d').value));
}
$('#eclat3d').addEventListener('input', (e) => etat.vue3d?.definirEclatement(Number(e.target.value)));
$('#nuit3d').addEventListener('click', (e) => { e.target.classList.toggle('actif'); etat.vue3d?.definirNuit(e.target.classList.contains('actif')); });
$('#cadrer3d').addEventListener('click', () => etat.vue3d?.cadrer());

// =====================================================================
//  Métré
// =====================================================================
function afficherMetre() {
  const me = metreEtude(etat.etude);
  $('#pMetre').innerHTML = `
    <div class="kpi"><div><b>${fmt(me.surfaceTotale)}</b><span>m² de pièces</span></div><div><b>${fmt(me.emprise)}</b><span>m² d'emprise</span></div><div><b>${me.blocs.toLocaleString('fr-FR')}</b><span>blocs (≈ 12,5/m²)</span></div></div>
    ${me.niveaux.map((n) => `<h4>${esc(n.niveau)} — ${n.dimensions}</h4>
      <table class="tm">${n.pieces.map((p) => `<tr><td>${esc(p.nom)}</td><td>${fmt(p.surface)} m²</td></tr>`).join('')}
      <tr class="tot"><td>Surface des pièces</td><td>${fmt(n.surfacePieces)} m²</td></tr>
      <tr><td>Murs extérieurs</td><td>${fmt(n.lineaireExt)} ml</td></tr><tr><td>Murs intérieurs</td><td>${fmt(n.lineaireInt)} ml</td></tr>
      <tr><td>Maçonnerie nette</td><td>${fmt(n.surfMursNette)} m²</td></tr><tr><td>Ouvertures</td><td>${n.portes} P · ${n.fenetres} F · ${n.baies} B</td></tr></table>`).join('')}
    <h4>Estimation indicative (prix unitaires modifiables)</h4>
    <table class="tm devis"><tr><th>Poste</th><th>Qté</th><th>PU $</th><th>Total $</th></tr>
      ${me.lignes.map((l) => `<tr><td>${esc(l.libelle)}</td><td>${fmt(l.quantite, l.unite === 'u' ? 0 : 1)} ${l.unite}</td><td><input type="number" min="0" step="1" data-prix="${l.cle}" value="${l.pu}"></td><td>${fmt(l.total, 0)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="3">Total gros œuvre et finitions (hors fondations, réseaux, main-d'œuvre spécialisée)</td><td>${fmt(me.totalGrosOeuvre, 0)}</td></tr></table>
    <p class="aide-pr">Ordres de grandeur pour les études de faisabilité. Demandez au <b>Métreur-économiste</b> un devis détaillé par lot.</p>`;
}
$('#pMetre').addEventListener('change', (ev) => {
  const k = ev.target.dataset.prix;
  if (k) commit(() => { etat.etude.prix[k] = Number(ev.target.value) || 0; });
});

// =====================================================================
//  Agents IA
// =====================================================================
const AGENTS = {
  architecte: { nom: 'Architecte concepteur', sugg: ['Propose un plan de maison plain-pied 3 chambres pour un terrain de 15 × 25 m', 'Améliore la distribution du niveau actuel', 'Propose l\'étage de ce bâtiment'] },
  ingenieur: { nom: 'Ingénieur structure', sugg: ['Propose une trame de poteaux et un pré-dimensionnement', 'Quels points de vigilance structurels sur ce plan ?', 'Dispositions parasismiques pour Goma'] },
  metreur: { nom: 'Métreur-économiste', sugg: ['Établis le devis estimatif détaillé par lot', 'Combien de sacs de ciment et de blocs pour ce projet ?'] },
  conformite: { nom: 'Conformité & climat', sugg: ['Analyse ce plan et liste les problèmes', 'Vérifie la ventilation et la protection solaire'] },
  redacteur: { nom: 'Rédacteur', sugg: ['Rédige la présentation commerciale pour le catalogue', 'Rédige la description architecturale réservée aux acheteurs'] },
};

function markdown(t) {
  const lignes = esc(t).split('\n');
  let h = '', table = [];
  const finTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !/^\|?[\s:|-]+\|?$/.test(r));
    h += `<table class="tm">${rows.map((r, i) => `<tr>${r.replace(/^\||\|$/g, '').split('|').map((c) => (i ? `<td>${c.trim()}</td>` : `<th>${c.trim()}</th>`)).join('')}</tr>`).join('')}</table>`;
    table = [];
  };
  for (const l of lignes) {
    if (/^\s*\|.*\|\s*$/.test(l)) { table.push(l.trim()); continue; }
    finTable();
    if (/^#{1,4}\s/.test(l)) h += `<h5>${l.replace(/^#+\s/, '')}</h5>`;
    else if (/^\s*[-*•]\s/.test(l)) h += `<li>${l.replace(/^\s*[-*•]\s/, '')}</li>`;
    else if (/^\s*\d+[.)]\s/.test(l)) h += `<li class="num">${l.trim()}</li>`;
    else if (l.trim()) h += `<p>${l}</p>`;
  }
  finTable();
  return h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

function conversation() {
  const cle = `${etat.etude?.id}:${etat.agent}`;
  etat.conversations[cle] = etat.conversations[cle] || [];
  return etat.conversations[cle];
}

function afficherAgent() {
  $('#agentChoix').innerHTML = Object.entries(AGENTS).map(([k, a]) => `<button data-agent="${k}" class="${k === etat.agent ? 'actif' : ''}">${esc(a.nom)}</button>`).join('');
  const conv = conversation();
  $('#agentFil').innerHTML = conv.map((m, i) => `<div class="am ${m.role}">${m.role === 'user' ? esc(m.content) : markdown(m.content)}
    ${m.proposition ? `<div class="proposition"><b>Proposition : ${esc(m.proposition.nom_niveau)}</b> — ${m.proposition.murs.length} murs, ${m.proposition.ouvertures.length} ouvertures, ${m.proposition.pieces.length} pièces (${fmt(m.proposition.pieces.reduce((s, p) => s + aire(p.points), 0))} m²)
      <div><button data-appliquer="${i}" data-mode="remplacer">Remplacer le niveau actuel</button><button data-appliquer="${i}" data-mode="ajouter">Ajouter comme nouveau niveau</button></div></div>` : ''}
    ${m.role === 'assistant' ? `<button class="copier" data-copier="${i}" title="Copier">⧉ Copier</button>` : ''}</div>`).join('')
    || `<div class="am vide">Choisissez un agent et posez votre question. L'agent reçoit automatiquement le plan et le métré de l'étude en cours.${etat.enLigne ? '' : '<br><br><b>Hors ligne :</b> les agents IA nécessitent la connexion au serveur de l\'atelier.'}</div>`;
  $('#agentSugg').innerHTML = AGENTS[etat.agent].sugg.map((s) => `<button>${esc(s)}</button>`).join('');
  $('#agentFil').scrollTop = $('#agentFil').scrollHeight;
}

async function envoyerAgent(texte) {
  texte = texte.trim();
  if (!texte || etat.agentEnCours) return;
  if (!etat.enLigne) { toast("Les agents IA nécessitent la connexion au serveur de l'atelier.", 'err'); return; }
  const conv = conversation();
  conv.push({ role: 'user', content: texte });
  afficherAgent();
  etat.agentEnCours = true;
  $('#agentFil').insertAdjacentHTML('beforeend', `<div class="am assistant attente">${esc(AGENTS[etat.agent].nom)} réfléchit… (une conception complète peut prendre une à deux minutes)</div>`);
  $('#agentFil').scrollTop = $('#agentFil').scrollHeight;
  try {
    const r = await api('/agent', {
      method: 'POST',
      body: JSON.stringify({ agent: etat.agent, contexte: resumePourAgents(etat.etude), messages: conv.map(({ role, content }) => ({ role, content })) }),
    });
    conv.push({ role: 'assistant', content: r.reponse, proposition: r.proposition || null });
  } catch (e) {
    conv.pop();
    toast(esc(e.message), 'err');
  } finally { etat.agentEnCours = false; afficherAgent(); }
}

$('#agentChoix').addEventListener('click', (e) => { const b = e.target.closest('[data-agent]'); if (b) { etat.agent = b.dataset.agent; afficherAgent(); } });
$('#agentSugg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) envoyerAgent(b.textContent); });
$('#agentForm').addEventListener('submit', (e) => { e.preventDefault(); envoyerAgent($('#agentTexte').value); $('#agentTexte').value = ''; });
$('#agentTexte').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#agentForm').requestSubmit(); } });
$('#agentFil').addEventListener('click', (e) => {
  const c = e.target.closest('[data-copier]');
  if (c) { navigator.clipboard?.writeText(conversation()[+c.dataset.copier].content); toast('Texte copié.'); return; }
  const b = e.target.closest('[data-appliquer]'); if (!b) return;
  const p = conversation()[+b.dataset.appliquer].proposition;
  const n = niveauDepuisProposition(p);
  if (b.dataset.mode === 'remplacer') {
    if (!confirm(`Remplacer le contenu de « ${niveauCourant().nom} » par la proposition ? (Ctrl+Z pour annuler)`)) return;
    commit(() => { n.id = niveauCourant().id; etat.etude.niveaux[etat.niveau] = n; });
  } else {
    commit(() => { etat.etude.niveaux.push(n); etat.niveau = etat.etude.niveaux.length - 1; });
  }
  majNiveaux(); editeur.selectionner(null); editeur.cadrer();
  toast('Proposition appliquée — vous pouvez la retoucher librement.');
});

// =====================================================================
//  Onglets du panneau droit
// =====================================================================
document.querySelector('#onglets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  document.querySelectorAll('#onglets [data-p]').forEach((x) => x.classList.toggle('actif', x === b));
  document.querySelectorAll('.panneau').forEach((p) => { p.hidden = p.id !== b.dataset.p; });
  if (b.dataset.p === 'p3d') { planifier3D(); setTimeout(() => etat.vue3d?.redimensionner(), 50); }
  if (b.dataset.p === 'pMetre') afficherMetre();
  if (b.dataset.p === 'pAgents') afficherAgent();
});

// =====================================================================
//  Barre du haut : études, niveaux, exports
// =====================================================================
function ouvrirModale(html) { $('#modaleContenu').innerHTML = html; $('#modale').hidden = false; }
function fermerModale() { $('#modale').hidden = true; }
$('#modale').addEventListener('click', (e) => { if (e.target.id === 'modale' || e.target.closest('[data-fermer]')) fermerModale(); });

async function fenetreEtudes() {
  ouvrirModale('<p>Chargement…</p>');
  let liste = [];
  try { liste = await listeEtudes(); } catch (e) { toast(esc(e.message), 'err'); }
  ouvrirModale(`<h3>Études ${etat.enLigne ? "de l'équipe" : 'de ce poste'}</h3>
    <div class="barre-modale"><button id="mNouvelle" class="principal">+ Nouvelle étude</button><label class="bouton">Importer (.json)<input type="file" accept=".json" id="mImporter" hidden></label></div>
    <table class="tm liste-etudes"><tr><th>Étude</th><th>Client</th><th>Niveaux</th><th>Modifiée</th><th></th></tr>
    ${liste.map((e) => `<tr><td><b>${esc(e.nom)}</b></td><td>${esc(e.client || '')}</td><td>${e.niveaux ?? ''}</td><td>${e.modifieLe ? new Date(e.modifieLe).toLocaleString('fr-FR') : ''}<br><small>${esc(e.modifiePar || '')}</small></td><td><button data-ouvrir="${esc(e.id)}">Ouvrir</button></td></tr>`).join('') || '<tr><td colspan="5">Aucune étude enregistrée.</td></tr>'}
    </table><button data-fermer>Fermer</button>`);
  $('#mNouvelle').addEventListener('click', () => {
    const nom = prompt("Nom de l'étude :", 'Nouvelle étude'); if (!nom) return;
    const e = nouvelleEtude(nom); e.version = 0; chargerEtude(e, true);
  });
  $('#mImporter').addEventListener('change', async (ev) => {
    try { const e = JSON.parse(await ev.target.files[0].text()); if (!Array.isArray(e.niveaux)) throw new Error(); e.id = uid(); e.version = 0; chargerEtude(e, true); } catch { toast('Fichier invalide.', 'err'); }
  });
  $('#modaleContenu').querySelectorAll('[data-ouvrir]').forEach((b) => b.addEventListener('click', () => ouvrirEtude(b.dataset.ouvrir)));
}

$('#btnEtudes').addEventListener('click', () => {
  if (etat.modifie && !confirm('Des modifications ne sont pas enregistrées. Continuer ?')) return;
  fenetreEtudes();
});
$('#btnEnregistrer').addEventListener('click', enregistrer);
$('#btnAnnuler').addEventListener('click', annuler);
$('#btnRetablir').addEventListener('click', retablir);
$('#nomEtude').addEventListener('change', (e) => commit(() => { etat.etude.nom = e.target.value.trim() || 'Sans nom'; }));
$('#niveau').addEventListener('change', (e) => { etat.niveau = Number(e.target.value); editeur.selectionner(null); editeur.rendre(); afficherProprietes(); });
$('#bt-ortho').addEventListener('click', () => basculer('ortho'));
$('#bt-aimant').addEventListener('click', () => basculer('aimant'));
$('#pas').addEventListener('change', (e) => { editeur.pas = Number(e.target.value); });
$('#btnCadrer').addEventListener('click', () => editeur.cadrer());
$('#btnNiveauPlus').addEventListener('click', () => {
  const choix = prompt('Nouveau niveau :\n1 = vide\n2 = copier les murs extérieurs du niveau actuel\n3 = copier tout le niveau actuel', '2');
  if (!choix) return;
  const src = niveauCourant();
  const n = nouveauNiveau(`Niveau ${etat.etude.niveaux.length}`, src.hauteur);
  if (choix === '2' || choix === '3') {
    const murs = src.murs.filter((m) => choix === '3' || m.exterieur);
    const ids = new Map(murs.map((m) => [m.id, uid()]));
    n.murs = murs.map((m) => ({ ...m, id: ids.get(m.id) }));
    if (choix === '3') {
      n.ouvertures = src.ouvertures.filter((o) => ids.has(o.murId)).map((o) => ({ ...o, id: uid(), murId: ids.get(o.murId) }));
      n.pieces = src.pieces.map((p) => ({ ...p, id: uid(), points: p.points.map((q) => ({ ...q })) }));
    }
  }
  commit(() => { etat.etude.niveaux.push(n); etat.niveau = etat.etude.niveaux.length - 1; });
  majNiveaux();
});
$('#btnNiveauMoins').addEventListener('click', () => {
  if (etat.etude.niveaux.length < 2) { toast('Une étude garde au moins un niveau.', 'err'); return; }
  if (!confirm(`Supprimer le niveau « ${niveauCourant().nom} » ? (Ctrl+Z pour annuler)`)) return;
  commit(() => { etat.etude.niveaux.splice(etat.niveau, 1); etat.niveau = Math.max(0, etat.niveau - 1); });
  majNiveaux();
});

$('#btnExporter').addEventListener('click', () => {
  ouvrirModale(`<h3>Exporter « ${esc(etat.etude.nom)} »</h3>
    <div class="grille-exports">
      <button data-x="dxf"><b>DXF</b><small>Niveau actuel, calques par élément — à ouvrir dans AutoCAD, ArchiCAD, Revit, LibreCAD</small></button>
      <button data-x="planche"><b>Planche PDF</b><small>Plan du niveau avec cartouche et tableau des surfaces, prête à imprimer</small></button>
      <button data-x="svg"><b>SVG</b><small>Plan vectoriel du niveau actuel</small></button>
      <button data-x="png3d"><b>Image 3D</b><small>Capture de la maquette (onglet 3D)</small></button>
      <button data-x="glb"><b>Maquette .glb publique</b><small>Murs extérieurs seulement, pour le site (sans aménagement intérieur)</small></button>
      <button data-x="glbcomplet"><b>Maquette .glb complète</b><small>Usage interne / client après paiement</small></button>
      <button data-x="json"><b>Étude (.json)</b><small>Sauvegarde complète, réimportable</small></button>
      <button data-x="catalogue" class="principal"><b>Envoyer au catalogue</b><small>Crée la fiche du plan (brouillon) dans l'espace concepteur + télécharge la maquette publique</small></button>
    </div><button data-fermer>Fermer</button>`);
  $('#modaleContenu').querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => exporter(b.dataset.x)));
});

async function exporter(type) {
  const e = etat.etude, n = niveauCourant();
  if (type === 'dxf') telecharger(nomFichier(e, n.nom, 'dxf'), exporterDXF(e, n), 'application/dxf');
  if (type === 'svg') telecharger(nomFichier(e, n.nom, 'svg'), editeur.exporterSVG(), 'image/svg+xml');
  if (type === 'json') { const copie = { ...e }; telecharger(nomFichier(e, '', 'json'), JSON.stringify(copie, null, 2), 'application/json'); }
  if (type === 'planche') {
    const w = window.open('', '_blank'); if (!w) { toast('Autorisez les fenêtres pop-up.', 'err'); return; }
    w.document.write(planche(e, n, editeur.exporterSVG({ largeurPx: 1400 }), etat.poste, 'Plan coté — échelle libre (impression ajustée à la feuille ; se référer aux cotes)'));
    w.document.close();
  }
  if (type === 'png3d') {
    if (!etat.vue3d) { toast("Ouvrez d'abord l'onglet 3D.", 'err'); return; }
    const a = document.createElement('a'); a.href = etat.vue3d.capture(1800); a.download = nomFichier(e, '3d', 'jpg'); a.click();
  }
  if (type === 'glb' || type === 'glbcomplet' || type === 'catalogue') {
    const blob = await exporterGLB(construireEtude3D(e, { exterieurSeul: type !== 'glbcomplet' }));
    const fiche = versCatalogue(e);
    telecharger(type === 'catalogue' ? `${fiche.id}.glb` : nomFichier(e, type === 'glb' ? 'public' : 'complet', 'glb'), blob);
  }
  if (type === 'catalogue') {
    const fiche = versCatalogue(e);
    const projets = structuredClone(await getProjets());
    const i = projets.findIndex((p) => p.id === fiche.id);
    if (i >= 0) { if (!confirm(`Le projet « ${fiche.id} » existe déjà dans le catalogue. Mettre à jour ses données techniques ?`)) return; projets[i] = { ...projets[i], ...fiche, prix: projets[i].prix, resume: projets[i].resume, description: projets[i].description, prive: { ...projets[i].prive, ...fiche.prive } }; }
    else projets.push(fiche);
    enregistrerProjetsLocaux(projets);
    journaliser('projet.enregistre', { ref: fiche.id, details: { titre: fiche.titre, origine: 'atelier', poste: etat.poste.nom } });
    toast(`Fiche « ${esc(fiche.titre)} » créée dans l'espace concepteur (sur ce navigateur). Complétez le prix et les textes dans <a href="admin.html" target="_blank">admin.html</a>, et déposez <b>${esc(fiche.id)}.glb</b> dans le dossier <code>modeles/</code>.`);
  }
}

$('#btnDeconnexion').addEventListener('click', () => {
  if (etat.modifie && !confirm('Des modifications ne sont pas enregistrées. Quitter ?')) return;
  sessionStorage.removeItem(CLE_CODE); location.reload();
});
window.addEventListener('beforeunload', (e) => { if (etat.modifie) { brouillon(); e.preventDefault(); e.returnValue = ''; } });

// =====================================================================
function demarrer() {
  $('#atelier').hidden = false;
  construirePalette();
  chargerEtude(nouvelleEtude('Nouvelle étude'), false);
  choisirOutil('mur');
  $('#bt-ortho').classList.toggle('actif', editeur.ortho);
  $('#bt-aimant').classList.toggle('actif', editeur.aimant);
  if (etat.poste.role === 'directeur' && etat.enLigne) $('#lienPostes').hidden = false;
  fenetreEtudes();
}

connexion();
