import { CONFIG } from './config.js';
import {
  detailPanier, formatPrix, changerLicence, retirerDuPanier, viderPanier,
  enregistrerCommande, genererReference, transmettre,
} from './store.js';
import { initialiserPage, esc, toast, lienWhatsApp, blocConfidentialite, PHRASE_CONFIDENTIALITE } from './ui.js';
import { vignette } from './viewer.js?v=7';

initialiserPage('panier');

// ---------------- Méthodes de paiement disponibles ----------------
function methodesDisponibles(lignes) {
  const m = [];
  const lienProjet = lignes.length === 1 && lignes[0].projet.lienPaiement;
  if (lienProjet || CONFIG.lienPaiementCarte) {
    m.push({ id: 'carte', nom: 'Carte bancaire', info: 'Paiement sécurisé en ligne (Visa, Mastercard…).' });
  }
  if (CONFIG.mobileMoney?.length) {
    m.push({ id: 'mobile', nom: 'Mobile Money', info: CONFIG.mobileMoney.map((x) => x.operateur).join(', ') });
  }
  if (CONFIG.transfertInternational?.actif) {
    m.push({ id: 'international', nom: "Depuis l'étranger (carte ou transfert)", info: `Payez par carte via ${CONFIG.transfertInternational.services.slice(0, 2).map((x) => x.nom).join(' ou ')} : l'argent arrive sur notre ${CONFIG.transfertInternational.operateur}.` });
  }
  if (CONFIG.banque?.iban) m.push({ id: 'virement', nom: 'Virement bancaire', info: 'Délai de 1 à 3 jours ouvrés.' });
  if (CONFIG.whatsapp) m.push({ id: 'whatsapp', nom: 'Commander via WhatsApp', info: 'Finalisez la commande en discutant avec le concepteur.' });
  return m;
}

let detail = { lignes: [], total: 0 };

async function rendre() {
  detail = await detailPanier();
  const { lignes, total } = detail;
  const zone = document.getElementById('lignes');
  const form = document.getElementById('formCommande');
  const valider = document.getElementById('valider');

  if (!lignes.length) {
    zone.innerHTML = `<div class="vide">Votre panier est vide.<br><br><a class="btn" href="index.html#catalogue">Découvrir les plans</a></div>`;
    form.hidden = true;
    valider.disabled = true;
  } else {
    form.hidden = false;
    valider.disabled = false;
    zone.innerHTML = lignes.map((l) => `
      <div class="ligne-panier">
        <a href="projet.html?id=${encodeURIComponent(l.id)}"><img src="${l.projet.images?.[0] || vignette(l.projet.modele, 360, 250)}" alt=""></a>
        <div>
          <h3><a href="projet.html?id=${encodeURIComponent(l.id)}">${esc(l.projet.titre)}</a></h3>
          <select class="champ" data-licence="${esc(l.id)}" aria-label="Licence">
            ${Object.entries(CONFIG.licences).map(([k, x]) => `<option value="${k}" ${k === l.licence ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}
          </select>
        </div>
        <div class="droite">
          <span class="prix">${formatPrix(l.prix)}</span>
          <button class="lien-suppr" data-suppr="${esc(l.id)}">Retirer</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('recapLignes').innerHTML = lignes.map((l) => `
    <div style="display:flex;justify-content:space-between;gap:1rem;font-size:.9rem;margin:.4rem 0">
      <span>${esc(l.projet.titre)} <span class="muted">· ${esc(CONFIG.licences[l.licence]?.nom)}</span></span><span>${formatPrix(l.prix)}</span>
    </div>`).join('') || '<p class="muted">—</p>';
  document.getElementById('total').textContent = formatPrix(total);

  const methodes = methodesDisponibles(lignes);
  const courant = document.querySelector('input[name=methode]:checked')?.value;
  document.getElementById('methodes').innerHTML = methodes.map((m, i) => `
    <label class="option">
      <input type="radio" name="methode" value="${m.id}" ${(courant ? courant === m.id : i === 0) ? 'checked' : ''}>
      <b>${esc(m.nom)}</b>
      <small>${esc(m.info)}</small>
    </label>`).join('') || '<p class="muted">Aucun moyen de paiement configuré (voir js/config.js).</p>';
}

document.getElementById('lignes').addEventListener('change', (e) => {
  const s = e.target.closest('[data-licence]');
  if (s) { changerLicence(s.dataset.licence, s.value); rendre(); }
});
document.getElementById('lignes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-suppr]');
  if (b) { retirerDuPanier(b.dataset.suppr); rendre(); }
});

// ---------------- Validation de la commande ----------------
document.getElementById('formCommande').addEventListener('submit', async (e) => {
  e.preventDefault();
  const methode = document.querySelector('input[name=methode]:checked')?.value;
  if (!detail.lignes.length) return;
  if (!methode) { toast('Choisissez un mode de paiement.', 'err'); return; }

  const commande = {
    ref: genererReference(),
    date: new Date().toISOString(),
    client: lireClient(),
    articles: detail.lignes.map((l) => ({ id: l.id, titre: l.projet.titre, licence: CONFIG.licences[l.licence]?.nom, prix: l.prix })),
    total: detail.total,
    devise: CONFIG.devise,
    methode,
    statut: 'en attente',
  };
  enregistrerCommande(commande);

  const btn = document.getElementById('valider');
  btn.disabled = true;
  btn.textContent = 'Envoi…';

  // Notification au concepteur (boîte aux requêtes en ligne / Formspree)
  const { distant } = await transmettre('commande', commande);

  const lignes = detail.lignes;
  viderPanier();
  confirmer(commande, lignes, distant);
});

function messageWhatsApp(c) {
  const cl = c.client;
  return `Bonjour, je souhaite commander :\n${c.articles.map((a) => `• ${a.titre} — ${a.licence} : ${formatPrix(a.prix)}`).join('\n')}\n\nTotal : ${formatPrix(c.total)}\nRéférence : ${c.ref}\nNom : ${cl.nom}${cl.raisonSociale ? ` (${cl.raisonSociale})` : ''}\nE-mail : ${cl.email}\nLieu de construction : ${lieuTexte(cl)}${cl.numeroPayeur ? `\nNuméro payeur : ${cl.numeroPayeur}` : ''}`;
}

// ---------------- Fiche de commande ----------------
const val = (id) => document.getElementById(id).value.trim();
const typeClient = () => document.querySelector('input[name=typeClient]:checked').value;

function lireClient() {
  const entreprise = typeClient() === 'entreprise';
  return {
    typeClient: typeClient(),
    nom: val('nom'),
    raisonSociale: entreprise ? val('raisonSociale') : '',
    rccmNif: entreprise ? val('rccmNif') : '',
    piece: val('pieceNumero') ? { type: val('pieceType') || 'Non précisé', numero: val('pieceNumero') } : null,
    telephone: val('tel'),
    email: val('email'),
    construction: { pays: val('pays'), ville: val('ville'), quartier: val('quartier'), parcelle: val('parcelle') },
    numeroPayeur: val('numeroPayeur'),
    note: val('note'),
  };
}

function lieuTexte(cl) {
  const l = cl.construction || {};
  return [l.parcelle, l.quartier, l.ville, l.pays].filter(Boolean).join(', ');
}

document.querySelector('[data-confidentialite]').innerHTML = blocConfidentialite();
document.querySelectorAll('input[name=typeClient]').forEach((r) => r.addEventListener('change', () => {
  const e = typeClient() === 'entreprise';
  document.querySelectorAll('[data-si-entreprise]').forEach((x) => { x.hidden = !e; });
  document.getElementById('raisonSociale').required = e;
}));

function bonDeCommande(c) {
  const cl = c.client;
  const e = CONFIG.entreprise;
  const masque = (n) => (n.length > 4 ? `${'•'.repeat(n.length - 4)}${n.slice(-4)}` : n);
  const ligne = (k, v) => (v ? `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>` : '');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon de commande ${esc(c.ref)}</title>
<style>body{font:13px/1.5 Arial,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 20px}
h1{font-size:22px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #b8894d;padding-bottom:3px;margin-top:22px}
table{width:100%;border-collapse:collapse}td,th{padding:5px 4px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}
.meta td:last-child{text-align:left;font-weight:600}.conf{background:#f3f7f3;border:1px solid #9cc5a8;padding:10px 12px;border-radius:6px;font-size:12px}
.entete{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:8px}@media print{.noprint{display:none}}</style></head><body>
<div class="noprint" style="text-align:right;margin-bottom:10px"><button onclick="print()">Imprimer / enregistrer en PDF</button></div>
<div class="entete"><div><b>${esc(e.raisonSociale)}</b><br>${esc(e.siege)}<br>${esc(CONFIG.telephone)}${CONFIG.email ? ` · ${esc(CONFIG.email)}` : ''}</div>
<div style="text-align:right"><h1>Bon de commande</h1>N° <b>${esc(c.ref)}</b><br>${new Date(c.date).toLocaleString('fr-FR')}</div></div>
<h2>Client</h2><table class="meta">
${ligne('Type', cl.typeClient === 'entreprise' ? 'Entreprise / organisation' : 'Particulier')}${ligne('Entreprise', cl.raisonSociale)}${ligne('RCCM / NIF', cl.rccmNif)}
${ligne('Nom', cl.nom)}${cl.piece ? ligne("Pièce d'identité", `${cl.piece.type} n° ${masque(cl.piece.numero)}`) : ''}${ligne('Téléphone', cl.telephone)}${ligne('E-mail', cl.email)}
${ligne('Lieu de la construction', lieuTexte(cl))}${ligne('Numéro payeur', cl.numeroPayeur)}</table>
<h2>Commande</h2><table><tr><th>Plan</th><th>Licence</th><th>Prix</th></tr>
${c.articles.map((a) => `<tr><td>${esc(a.titre)}</td><td>${esc(a.licence)}</td><td>${formatPrix(a.prix)}</td></tr>`).join('')}
<tr><td colspan="2"><b>Total à payer</b></td><td><b>${formatPrix(c.total)}</b></td></tr></table>
<p>Mode de paiement choisi : <b>${esc(({ carte: 'Carte bancaire', mobile: 'Mobile Money', international: "Depuis l'étranger (transfert vers Mobile Money)", virement: 'Virement bancaire', whatsapp: 'WhatsApp' })[c.methode] || c.methode)}</b>. Indiquez la référence <b>${esc(c.ref)}</b> lors du paiement, et payez <b>uniquement</b> sur les numéros officiels affichés sur le site. Les fichiers sont envoyés après vérification du paiement. La licence vaut pour une construction sur le terrain indiqué, sauf licence Exclusivité.</p>
<div class="conf">🔒 <b>Votre vie privée est respectée.</b> ${esc(PHRASE_CONFIDENTIALITE)}</div>
<p style="font-size:11px;color:#666;margin-top:14px">Commande soumise aux conditions générales de vente et à la licence d'utilisation de ${esc(e.raisonSociale)}, acceptées par le client lors de la commande.</p>
</body></html>`;
}

function confirmer(c, lignes, distant = false) {
  document.getElementById('vueCommande').hidden = true;
  const v = document.getElementById('vueConfirmation');
  v.hidden = false;
  window.scrollTo(0, 0);

  let instructions = '';
  let action = '';
  if (c.methode === 'carte') {
    const lien = (lignes.length === 1 && lignes[0].projet.lienPaiement) || CONFIG.lienPaiementCarte;
    const url = new URL(lien);
    url.searchParams.set('prefilled_email', c.client.email);
    url.searchParams.set('client_reference_id', c.ref);
    instructions = `<p>Vous allez être redirigé vers la page de paiement sécurisée. Montant à régler : <b>${formatPrix(c.total)}</b>.</p>`;
    action = `<a class="btn" href="${esc(url.toString())}">Payer ${formatPrix(c.total)} par carte</a>`;
    setTimeout(() => { location.href = url.toString(); }, 2500);
  } else if (c.methode === 'mobile') {
    instructions = `<p>Envoyez <b>${formatPrix(c.total)}</b> sur l'un des comptes suivants en indiquant la référence <span class="ref">${esc(c.ref)}</span> :</p>
      <ul class="liste-coche">${CONFIG.mobileMoney.map((m) => `<li><b>${esc(m.operateur)}</b> : <code>${esc(m.numero)}</code>${m.titulaire ? ` (${esc(m.titulaire)})` : ''}</li>`).join('')}</ul>
      <p style="margin-top:1rem">Envoyez ensuite la capture de la transaction par WhatsApp pour recevoir vos plans.</p>
      <p class="muted" style="font-size:.85rem">⚠ Ne payez que sur le(s) numéro(s) ci-dessus. Nous ne demandons jamais de paiement vers un autre numéro.</p>`;
    if (CONFIG.whatsapp) action = `<a class="btn" target="_blank" rel="noopener" href="${lienWhatsApp(messageWhatsApp(c) + '\n\nJe viens d\'effectuer le paiement Mobile Money.')}">Envoyer la preuve sur WhatsApp</a>`;
  } else if (c.methode === 'virement') {
    const b = CONFIG.banque;
    instructions = `<p>Effectuez un virement de <b>${formatPrix(c.total)}</b> avec la référence <span class="ref">${esc(c.ref)}</span> :</p>
      <table class="tab"><tr><td>Banque</td><td>${esc(b.banque)}</td></tr><tr><td>Titulaire</td><td>${esc(b.titulaire)}</td></tr><tr><td>IBAN</td><td><code>${esc(b.iban)}</code></td></tr><tr><td>BIC / SWIFT</td><td><code>${esc(b.swift)}</code></td></tr></table>`;
    action = CONFIG.email
      ? `<a class="btn" href="mailto:${esc(CONFIG.email)}?subject=${encodeURIComponent('Virement commande ' + c.ref)}&body=${encodeURIComponent(messageWhatsApp(c))}">Envoyer l'avis de virement par e-mail</a>`
      : `<a class="btn" target="_blank" rel="noopener" href="${lienWhatsApp(messageWhatsApp(c) + '\n\nVirement effectué.')}">Envoyer l'avis de virement sur WhatsApp</a>`;
  } else if (c.methode === 'international') {
    const t = CONFIG.transfertInternational;
    instructions = `<p>Vous pouvez payer depuis n'importe quel pays, <b>avec votre carte bancaire</b>, via un service de transfert international. L'argent arrive directement sur notre compte ${esc(t.operateur)}.</p>
      <ol class="liste-coche">
        <li>Ouvrez l'un de ces services : ${t.services.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:var(--or)">${esc(x.nom)}</a>`).join(', ')}.</li>
        <li>Pays de destination : <b>RD Congo</b>. Mode de réception : <b>Mobile Money — ${esc(t.operateur)}</b>.</li>
        <li>Numéro du bénéficiaire : <code>${esc(t.numero)}</code>${t.beneficiaire ? ` — nom : <b>${esc(t.beneficiaire)}</b>` : ' — demandez-nous le nom exact du bénéficiaire sur WhatsApp avant d\'envoyer'}.</li>
        <li>Montant à faire <b>recevoir</b> : <b>${formatPrix(c.total)}</b>. Les frais du service sont à votre charge. Indiquez la référence <span class="ref">${esc(c.ref)}</span> en motif si le service le permet.</li>
        <li>Envoyez-nous ensuite le reçu du transfert sur WhatsApp. Vos plans vous sont envoyés dès la réception des fonds.</li>
      </ol>
      <p class="muted" style="font-size:.85rem">⚠ N'envoyez de l'argent qu'au numéro ci-dessus. Nous ne demandons jamais de paiement vers un autre numéro ou un autre nom.</p>`;
    action = `<a class="btn" target="_blank" rel="noopener" href="${lienWhatsApp(`${messageWhatsApp(c)}\n\nJe paie depuis l'étranger.${t.beneficiaire ? '' : ' Pouvez-vous me confirmer le nom exact du bénéficiaire ?'}`)}">${t.beneficiaire ? 'Envoyer le reçu sur WhatsApp' : 'Demander le nom du bénéficiaire sur WhatsApp'}</a>`;
  } else if (c.methode === 'whatsapp') {
    instructions = `<p>Votre commande est prête. Cliquez ci-dessous pour l'envoyer au concepteur sur WhatsApp et convenir du paiement.</p>`;
    action = `<a class="btn" target="_blank" rel="noopener" href="${lienWhatsApp(messageWhatsApp(c))}">Ouvrir WhatsApp</a>`;
  }

  v.innerHTML = `
    <div class="succes-icone">✓</div>
    <h1 style="font-size:2.8rem">Merci ${esc(c.client.nom.split(' ')[0])} !</h1>
    <p class="muted">Votre commande <span class="ref">${esc(c.ref)}</span> a bien été enregistrée.</p>
    ${distant ? '' : `<div class="alerte" style="margin:1rem 0"><b>Important :</b> pour que votre commande nous parvienne, envoyez-la-nous sur WhatsApp avec le bouton ci-dessous.</div>`}
    <div class="instructions">${instructions}</div>
    <div style="display:flex;flex-wrap:wrap;gap:.7rem;margin:1.5rem 0">${action}<button class="btn discret" id="bonCommande" type="button">📄 Mon bon de commande</button><a class="btn discret" href="index.html#catalogue">Retour au catalogue</a></div>
    <div class="encart">
      <h4>Détail</h4>
      <table class="tab">
        ${c.articles.map((a) => `<tr><td>${esc(a.titre)} <span class="muted">· ${esc(a.licence)}</span></td><td>${formatPrix(a.prix)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td><b>${formatPrix(c.total)}</b></td></tr>
      </table>
      <p class="muted" style="margin-top:1rem;font-size:.88rem">Les fichiers seront envoyés à <b>${esc(c.client.email)}</b> dès réception et vérification du paiement.</p>
    </div>
    ${blocConfidentialite()}`;
  document.getElementById('bonCommande').addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Autorisez les fenêtres pop-up pour afficher le bon.', 'err'); return; }
    w.document.write(bonDeCommande(c));
    w.document.close();
  });
}

rendre();
