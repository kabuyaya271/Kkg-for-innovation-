// Onglet « Historique » : consultation, vérification et export du journal des opérations
import { CONFIG } from './config.js';
import { esc, toast } from './ui.js';
import {
  lireJournalLocal, lireJournalServeur, verifierChaine, journaliser, sha256, canonique,
  LIBELLES_EVENEMENTS, CLE_JETON,
} from './journal.js';

const $ = (id) => document.getElementById(id);
let complet = [];          // journal complet de la source choisie
let verification = null;   // résultat de la vérification du journal complet
let source = 'local';

const libelle = (ev) => LIBELLES_EVENEMENTS[ev] || ev;
const dateFr = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

function texteDetails(d) {
  if (!d || typeof d !== 'object') return String(d ?? '');
  return Object.entries(d).filter(([, v]) => v !== '' && v !== undefined && v !== null).map(([k, v]) => {
    if (v && typeof v === 'object' && 'avant' in v && 'apres' in v) return `${k} : ${v.avant || '—'} → ${v.apres}`;
    if (Array.isArray(v)) return `${k} : ${v.map((x) => (typeof x === 'object' ? Object.values(x).join(' / ') : x)).join(' ; ')}`;
    if (typeof v === 'object') return `${k} : ${Object.entries(v).map(([a, b]) => `${a}=${b}`).join(', ')}`;
    return `${k} : ${v}`;
  }).join('\n');
}
const texteClient = (c = {}) => [c.nom, c.telephone, c.email].filter(Boolean).join(' · ');
const texteOrigine = (e) => [e.origine, e.reseau?.ip && `IP ${e.reseau.ip}`, e.reseau?.pays].filter(Boolean).join(' · ');

// ---------------- Chargement ----------------
async function charger() {
  source = $('hSource').value;
  $('hEtat').textContent = 'Chargement…';
  complet = [];
  if (source === 'serveur') {
    if (!CONFIG.agentIA) {
      $('hEtat').innerHTML = "Journal en ligne non configuré (champ <code>agentIA</code>). Affichage du journal de cet appareil.";
      $('hSource').value = source = 'local';
    } else {
      if (!sessionStorage.getItem(CLE_JETON)) {
        const j = prompt("Jeton d'accès (ADMIN_TOKEN) :") || '';
        if (j) sessionStorage.setItem(CLE_JETON, j);
      }
      try { complet = (await lireJournalServeur()) || []; } catch (e) {
        if (String(e.message).includes('Jeton')) sessionStorage.removeItem(CLE_JETON);
        $('hEtat').textContent = `Journal en ligne inaccessible (${e.message}). Affichage du journal de cet appareil.`;
        $('hSource').value = source = 'local';
      }
    }
  }
  if (source === 'local') complet = lireJournalLocal();
  verification = await verifierChaine(complet);
  const types = [...new Set(complet.map((e) => e.evenement))];
  const courant = $('hType').value;
  $('hType').innerHTML = '<option value="">Tous</option>' + types.map((t) => `<option value="${esc(t)}" ${t === courant ? 'selected' : ''}>${esc(libelle(t))}</option>`).join('');
  afficher();
}

function filtrer() {
  const du = $('hDu').value ? new Date(`${$('hDu').value}T00:00:00`) : null;
  const au = $('hAu').value ? new Date(`${$('hAu').value}T23:59:59.999`) : null;
  const type = $('hType').value;
  const q = $('hRecherche').value.trim().toLowerCase();
  const qChiffres = q.replace(/\D/g, '');
  return complet.filter((e) => {
    const d = new Date(e.date);
    if (du && d < du) return false;
    if (au && d > au) return false;
    if (type && e.evenement !== type) return false;
    if (q) {
      const texte = JSON.stringify(e).toLowerCase();
      if (!texte.includes(q) && !(qChiffres.length >= 6 && texte.replace(/\D/g, '').includes(qChiffres))) return false;
    }
    return true;
  });
}

function etatIntegrite() {
  if (!verification) return '';
  return verification.ok
    ? `<span class="integrite-ok">✔ Intégrité vérifiée : ${verification.total} entrée(s), chaîne complète et non modifiée.</span>`
    : `<span class="integrite-ko">✖ Anomalies détectées :</span><br>${verification.anomalies.map(esc).join('<br>')}`;
}

function afficher() {
  const liste = filtrer();
  $('hEtat').innerHTML = `${source === 'serveur' ? 'Journal en ligne' : 'Journal de cet appareil'} — ${liste.length} entrée(s) affichée(s) sur ${complet.length}. ${etatIntegrite()}`;
  $('hTable').innerHTML = liste.length ? `<tr><th>N°</th><th>Date et heure</th><th>Événement</th><th>Référence</th><th>Client</th><th>Origine</th><th>Détails</th><th>Empreinte</th></tr>` +
    liste.slice().reverse().map((e) => `<tr>
      <td>${e.n}</td><td style="white-space:nowrap">${esc(dateFr(e.date))}</td><td>${esc(libelle(e.evenement))}</td>
      <td>${e.ref ? `<span class="ref">${esc(e.ref)}</span>` : ''}</td><td>${esc(texteClient(e.client))}</td><td>${esc(texteOrigine(e))}</td>
      <td style="white-space:pre-wrap">${esc(texteDetails(e.details))}</td><td title="${esc(e.hash)}">${esc(e.hash.slice(0, 16))}…</td></tr>`).join('')
    : '<tr><td class="muted">Aucune opération pour ces critères.</td></tr>';
}

// ---------------- Exports ----------------
async function preparerExtrait() {
  const entrees = filtrer();
  const ent = CONFIG.entreprise;
  const meta = {
    entreprise: ent.raisonSociale,
    identification: [ent.formeJuridique, ent.rccm && `RCCM ${ent.rccm}`, ent.idNat && `Id. Nat. ${ent.idNat}`, ent.nif && `NIF ${ent.nif}`].filter(Boolean).join(' — '),
    siege: ent.siege,
    contacts: [CONFIG.telephone, CONFIG.email].filter(Boolean).join(' — '),
    source: source === 'serveur' ? 'Journal en ligne (serveur)' : 'Journal local (appareil du concepteur)',
    extraitLe: new Date().toISOString(),
    periode: `${$('hDu').value || 'début'} → ${$('hAu').value || "aujourd'hui"}`,
    filtres: [$('hType').value && `événement = ${libelle($('hType').value)}`, $('hRecherche').value && `recherche = « ${$('hRecherche').value} »`].filter(Boolean).join(' ; ') || 'aucun',
    nombreEntrees: entrees.length,
    integriteJournalComplet: verification.ok ? 'conforme' : `ANOMALIES : ${verification.anomalies.join(' | ')}`,
    entreesJournalComplet: verification.total,
    empreinteDerniereEntree: verification.derniere,
  };
  meta.empreinteExtrait = await sha256(canonique(entrees));
  return { meta, entrees };
}

function telecharger(nom, contenu, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

const nomFichier = (ext) => `journal-kkg-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`;

function documentHtml({ meta, entrees }, pourWord = false) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Extrait du journal des opérations — ${esc(meta.entreprise)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font: 11px/1.45 Arial, sans-serif; color: #111; margin: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; } .entete { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #999; padding: 4px 5px; text-align: left; vertical-align: top; }
  th { background: #eee; } td.d { white-space: pre-wrap; } td.h { font-family: monospace; font-size: 9px; word-break: break-all; }
  .meta td { border: 0; padding: 1px 8px 1px 0; } .sign { margin-top: 30px; display: flex; gap: 80px; }
  .noprint { margin-bottom: 10px } @media print { .noprint { display: none } }
</style></head><body>
${pourWord ? '' : '<div class="noprint"><button onclick="print()">Imprimer / enregistrer en PDF</button></div>'}
<div class="entete"><div><b>${esc(meta.entreprise)}</b><br>${esc(meta.identification)}<br>${esc(meta.siege)}<br>${esc(meta.contacts)}</div>
<div style="text-align:right"><h1>Extrait du journal des opérations</h1>Extrait le ${esc(dateFr(meta.extraitLe))}</div></div>
<table class="meta">
<tr><td>Source</td><td><b>${esc(meta.source)}</b></td></tr>
<tr><td>Période</td><td>${esc(meta.periode)}</td></tr>
<tr><td>Filtres</td><td>${esc(meta.filtres)}</td></tr>
<tr><td>Entrées de l'extrait</td><td>${meta.nombreEntrees} (journal complet : ${meta.entreesJournalComplet} entrées)</td></tr>
<tr><td>Intégrité du journal complet</td><td><b>${esc(meta.integriteJournalComplet)}</b></td></tr>
<tr><td>Empreinte de la dernière entrée</td><td style="font-family:monospace">${esc(meta.empreinteDerniereEntree)}</td></tr>
<tr><td>Empreinte de l'extrait</td><td style="font-family:monospace">${esc(meta.empreinteExtrait)}</td></tr>
</table><br>
<table><tr><th>N°</th><th>Date et heure</th><th>Événement</th><th>Référence</th><th>Client</th><th>Origine</th><th>Détails</th><th>Empreinte SHA-256 / précédente</th></tr>
${entrees.map((e) => `<tr><td>${e.n}</td><td>${esc(dateFr(e.date))}<br><small>${esc(e.date)}</small></td><td>${esc(libelle(e.evenement))}</td><td>${esc(e.ref)}</td>
<td>${esc(texteClient(e.client))}</td><td>${esc(texteOrigine(e))}</td><td class="d">${esc(texteDetails(e.details))}</td><td class="h">${esc(e.hash)}<br>↳ ${esc(e.precedent)}</td></tr>`).join('')}
</table>
<p style="margin-top:14px;font-size:10px">Méthode de contrôle : chaque entrée contient l'empreinte SHA-256 de son propre contenu (représentation JSON aux clés triées, sans le champ « hash ») ainsi que l'empreinte de l'entrée précédente. Toute modification, insertion ou suppression rompt la chaîne. Le fichier JSON fourni avec cet extrait permet de recalculer ces empreintes.</p>
<div class="sign"><div>Fait à ____________________, le ____________________</div><div>Pour ${esc(meta.entreprise)}, nom, signature et cachet :<br><br><br>____________________________</div></div>
</body></html>`;
}

async function exporter(format) {
  // la fenêtre d'impression doit s'ouvrir immédiatement (sinon bloquée par le navigateur)
  const w = format === 'imprimer' ? window.open('', '_blank') : null;
  if (format === 'imprimer' && !w) { toast('Autorisez les fenêtres pop-up.', 'err'); return; }
  if (!verification) await charger();
  const extrait = await preparerExtrait();
  const { meta, entrees } = extrait;
  if (format === 'imprimer') {
    w.document.write(documentHtml(extrait));
    w.document.close();
  } else if (format === 'word') {
    telecharger(nomFichier('doc'), `﻿${documentHtml(extrait, true)}`, 'application/msword');
  } else if (format === 'json') {
    telecharger(nomFichier('json'), JSON.stringify({ extrait: meta, entrees }, null, 2), 'application/json');
  } else if (format === 'csv') {
    const lignes = [['n', 'date_iso', 'date_locale', 'evenement', 'reference', 'client_nom', 'client_telephone', 'client_email', 'origine', 'ip', 'pays', 'details', 'empreinte', 'empreinte_precedente']];
    for (const e of entrees) {
      lignes.push([e.n, e.date, dateFr(e.date), libelle(e.evenement), e.ref, e.client?.nom, e.client?.telephone, e.client?.email, e.origine,
        e.reseau?.ip, e.reseau?.pays, texteDetails(e.details).replace(/\n/g, ' | '), e.hash, e.precedent]);
    }
    const entete = [`# ${meta.entreprise} — extrait du journal du ${dateFr(meta.extraitLe)} — intégrité : ${meta.integriteJournalComplet} — empreinte de l'extrait : ${meta.empreinteExtrait}`];
    const csv = [entete, ...lignes].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    telecharger(nomFichier('csv'), `﻿${csv}`, 'text/csv;charset=utf-8');
  } else if (format === 'texte') {
    const t = [
      `${meta.entreprise} — EXTRAIT DU JOURNAL DES OPÉRATIONS`, meta.identification, meta.siege, '',
      `Extrait le : ${dateFr(meta.extraitLe)}`, `Source : ${meta.source}`, `Période : ${meta.periode}`, `Filtres : ${meta.filtres}`,
      `Intégrité du journal complet : ${meta.integriteJournalComplet}`, `Empreinte de l'extrait : ${meta.empreinteExtrait}`, '',
      ...entrees.map((e) => [`#${e.n} — ${dateFr(e.date)} — ${libelle(e.evenement)}${e.ref ? ` — ${e.ref}` : ''}`,
        e.client?.nom || e.client?.telephone ? `   Client : ${texteClient(e.client)}` : '', `   Origine : ${texteOrigine(e)}`,
        ...texteDetails(e.details).split('\n').filter(Boolean).map((l) => `   ${l}`), `   Empreinte : ${e.hash}`].filter(Boolean).join('\n')),
    ].join('\n');
    telecharger(nomFichier('txt'), t, 'text/plain;charset=utf-8');
  }
  await journaliser('journal.extrait', { details: { format, source: meta.source, periode: meta.periode, filtres: meta.filtres, entrees: meta.nombreEntrees, empreinteExtrait: meta.empreinteExtrait } });
  if (source === 'local') { complet = lireJournalLocal(); verification = await verifierChaine(complet); afficher(); }
}

let pret = false;
export function initialiserHistorique() {
  if (pret) return;
  pret = true;
  if (!CONFIG.agentIA) $('hSource').value = 'local';
  $('hSource').addEventListener('change', charger);
  ['hDu', 'hAu', 'hType'].forEach((id) => $(id).addEventListener('change', afficher));
  $('hRecherche').addEventListener('input', afficher);
  $('hImprimer').addEventListener('click', () => exporter('imprimer'));
  $('hCSV').addEventListener('click', () => exporter('csv'));
  $('hWord').addEventListener('click', () => exporter('word'));
  $('hJSON').addEventListener('click', () => exporter('json'));
  $('hTexte').addEventListener('click', () => exporter('texte'));
  $('hVerifier').addEventListener('click', async () => {
    await charger();
    toast(verification.ok ? 'Journal intègre : aucune modification détectée.' : 'Anomalies détectées dans le journal !', verification.ok ? 'ok' : 'err');
  });
  document.querySelector('[data-onglet="historique"]').addEventListener('click', charger);
}
