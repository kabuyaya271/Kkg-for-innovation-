import { CONFIG } from './config.js';
import { initialiserPage, blocContacts } from './ui.js';

initialiserPage();

const e = CONFIG.entreprise;
const sm = CONFIG.surMesure;
const valeurs = {
  societe: e.raisonSociale,
  forme: e.formeJuridique ? `(${e.formeJuridique})` : '',
  siege: e.siege, rccm: e.rccm, idnat: e.idNat, nif: e.nif, responsable: e.responsable,
  devise: CONFIG.devise,
  date: CONFIG.dateConditions,
  acompte: sm.acomptePourcent,
  solde: 100 - sm.acomptePourcent,
  revisions: sm.revisionsIncluses,
  validite: sm.validiteDevisJours,
  reclamation: sm.delaiReclamationJours,
};

document.querySelectorAll('[data-c]').forEach((el) => {
  if (el.dataset.c === 'contacts') el.innerHTML = blocContacts();
  else el.textContent = valeurs[el.dataset.c] ?? '';
});
// masque les lignes des mentions légales non renseignées
document.querySelectorAll('[data-si]').forEach((el) => { el.hidden = !valeurs[el.dataset.si]; });

if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
