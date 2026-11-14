// Données : projets, panier, commandes
import { CONFIG } from './config.js';

const LS_PROJETS = 'kkg_projets';
const LS_PANIER = 'kkg_panier';
const LS_COMMANDES = 'kkg_commandes';

const lire = (k, def) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
};
const ecrire = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.error(e); return false; }
};

// ---------------- Projets ----------------
let cache = null;

export async function chargerProjetsFichier() {
  const r = await fetch('data/projets.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Impossible de charger data/projets.json');
  return r.json();
}

/** Projets visibles : version locale de l'espace concepteur si elle existe, sinon le fichier publié. */
export async function getProjets() {
  if (cache) return cache;
  const local = lire(LS_PROJETS, null);
  cache = Array.isArray(local) ? local : await chargerProjetsFichier();
  return cache;
}

export async function getProjet(id) {
  return (await getProjets()).find((p) => p.id === id) || null;
}

export function enregistrerProjetsLocaux(projets) {
  cache = projets;
  return ecrire(LS_PROJETS, projets);
}

export function aDesModificationsLocales() {
  return lire(LS_PROJETS, null) !== null;
}

export function supprimerModificationsLocales() {
  localStorage.removeItem(LS_PROJETS);
  cache = null;
}

// ---------------- Prix ----------------
export function formatPrix(v) {
  return new Intl.NumberFormat(CONFIG.locale, {
    style: 'currency', currency: CONFIG.devise, maximumFractionDigits: 0,
  }).format(v);
}

export function prixLicence(projet, licence) {
  const l = CONFIG.licences[licence] || CONFIG.licences.essentiel;
  return Math.round(projet.prix * l.multiplicateur);
}

// ---------------- Panier ----------------
export function getPanier() { return lire(LS_PANIER, []); }

function setPanier(p) {
  ecrire(LS_PANIER, p);
  window.dispatchEvent(new CustomEvent('panier:change', { detail: p }));
}

export function ajouterAuPanier(id, licence = 'essentiel') {
  const p = getPanier();
  const ex = p.find((i) => i.id === id);
  if (ex) ex.licence = licence; else p.push({ id, licence });
  setPanier(p);
}

export function changerLicence(id, licence) {
  const p = getPanier();
  const ex = p.find((i) => i.id === id);
  if (ex) { ex.licence = licence; setPanier(p); }
}

export function retirerDuPanier(id) { setPanier(getPanier().filter((i) => i.id !== id)); }
export function viderPanier() { setPanier([]); }

export async function detailPanier() {
  const projets = await getProjets();
  const lignes = getPanier()
    .map((i) => {
      const projet = projets.find((p) => p.id === i.id);
      return projet ? { ...i, projet, prix: prixLicence(projet, i.licence) } : null;
    })
    .filter(Boolean);
  return { lignes, total: lignes.reduce((s, l) => s + l.prix, 0) };
}

// ---------------- Commandes ----------------
export function getCommandes() { return lire(LS_COMMANDES, []); }

export function enregistrerCommande(c) {
  const all = getCommandes();
  all.unshift(c);
  ecrire(LS_COMMANDES, all);
}

export function majCommande(ref, changes) {
  const all = getCommandes().map((c) => (c.ref === ref ? { ...c, ...changes } : c));
  ecrire(LS_COMMANDES, all);
}

export function genererReference() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `KKG-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
