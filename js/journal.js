// Journal des opérations — chaîné par empreintes SHA-256 (preuve d'intégrité)
// Même algorithme que le serveur (agent-ia/src/index.js) : les deux journaux
// peuvent être vérifiés ici.
import { CONFIG } from './config.js';

const LS = 'kkg_journal';
export const CLE_JETON = 'kkg_jeton_agent';
const URL_AGENT = (CONFIG.agentIA || '').replace(/\/$/, '');

export const LIBELLES_EVENEMENTS = {
  'commande.recue': 'Commande reçue',
  'commande.statut': 'Commande : changement de statut',
  'commande.paiement': 'Paiement enregistré',
  'requete.recue': 'Requête reçue',
  'requete.statut': 'Requête : changement de statut',
  'requete.modifiee': 'Requête modifiée',
  'fiche.remise': 'Fiche acheteur / documents remis',
  'projet.enregistre': 'Projet créé ou modifié',
  'projet.supprime': 'Projet supprimé',
  'catalogue.export': 'Catalogue public exporté',
  'sauvegarde.privee': 'Sauvegarde des détails réservés',
  'journal.extrait': 'Extrait du journal produit',
  'poste.connexion': 'Connexion à un poste',
  'poste.cree': 'Poste créé',
  'poste.active': 'Poste réactivé',
  'poste.desactive': 'Poste désactivé',
  'poste.nouveau_code': "Nouveau code d'accès",
  'etude.enregistree': 'Étude enregistrée',
  'etude.supprimee': 'Étude supprimée',
};

export function canonique(v) {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => k !== 'hash' && v[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export async function sha256(texte) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function lireJournalLocal() {
  try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; }
}

/**
 * Ajoute un événement au journal local (chaîné) et, si la boîte aux requêtes
 * en ligne est configurée, au journal du serveur.
 */
export async function journaliser(evenement, { ref = '', client = {}, details = {} } = {}) {
  const j = lireJournalLocal();
  const prec = j.length ? j[j.length - 1] : { n: 0, hash: 'ORIGINE' };
  const entree = JSON.parse(JSON.stringify({
    n: prec.n + 1,
    date: new Date().toISOString(),
    evenement,
    ref,
    client: { nom: client.nom || '', telephone: client.telephone || '', email: client.email || '' },
    origine: 'concepteur',
    details,
    precedent: prec.hash,
  }));
  entree.hash = await sha256(canonique(entree));
  j.push(entree);
  try { localStorage.setItem(LS, JSON.stringify(j)); } catch (e) { console.error('Journal local plein', e); }

  const jeton = sessionStorage.getItem(CLE_JETON);
  if (URL_AGENT && jeton) {
    fetch(`${URL_AGENT}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ evenement, ref, client, details }),
    }).catch((e) => console.warn('Journal en ligne indisponible', e));
  }
  return entree;
}

export async function lireJournalServeur() {
  const jeton = sessionStorage.getItem(CLE_JETON);
  if (!URL_AGENT || !jeton) return null;
  const r = await fetch(`${URL_AGENT}/journal`, { headers: { Authorization: `Bearer ${jeton}` } });
  if (!r.ok) throw new Error(r.status === 401 ? 'Jeton refusé' : `Erreur ${r.status}`);
  return r.json();
}

/** Vérifie que chaque entrée est intacte et que la chaîne n'a ni trou ni modification. */
export async function verifierChaine(entrees) {
  const anomalies = [];
  let prec = null;
  for (const e of entrees) {
    const calcule = await sha256(canonique(e));
    if (calcule !== e.hash) anomalies.push(`Entrée n° ${e.n} : contenu modifié (empreinte invalide)`);
    if (prec && e.precedent !== prec.hash) anomalies.push(`Entrée n° ${e.n} : lien rompu avec l'entrée précédente`);
    if (prec && e.n !== prec.n + 1) anomalies.push(`Entre les n° ${prec.n} et ${e.n} : entrée(s) manquante(s)`);
    if (!prec && e.n === 1 && e.precedent !== 'ORIGINE') anomalies.push('Entrée n° 1 : origine invalide');
    prec = e;
  }
  return { ok: anomalies.length === 0, anomalies, total: entrees.length, derniere: prec?.hash || '' };
}
