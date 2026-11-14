import { CONFIG } from './config.js';
import {
  detailPanier, formatPrix, changerLicence, retirerDuPanier, viderPanier,
  enregistrerCommande, genererReference,
} from './store.js';
import { initialiserPage, esc, toast } from './ui.js';
import { vignette } from './viewer.js';

initialiserPage('panier');

// ---------------- Méthodes de paiement disponibles ----------------
function methodesDisponibles(lignes) {
  const m = [];
  const stripeProjet = lignes.length === 1 && lignes[0].projet.lienPaiement;
  if (stripeProjet || CONFIG.stripeLienGeneral) {
    m.push({ id: 'carte', nom: 'Carte bancaire', info: 'Paiement sécurisé par Stripe (Visa, Mastercard…).' });
  }
  if (CONFIG.mobileMoney?.length) {
    m.push({ id: 'mobile', nom: 'Mobile Money', info: CONFIG.mobileMoney.map((x) => x.operateur).join(', ') });
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
    client: {
      nom: document.getElementById('nom').value.trim(),
      email: document.getElementById('email').value.trim(),
      telephone: document.getElementById('tel').value.trim(),
      pays: document.getElementById('pays').value.trim(),
      note: document.getElementById('note').value.trim(),
    },
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

  // Notification au concepteur (Formspree)
  if (CONFIG.formspree) {
    try {
      await fetch(CONFIG.formspree, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Nouvelle commande ${commande.ref} — ${formatPrix(commande.total)}`,
          _replyto: commande.client.email,
          reference: commande.ref,
          ...commande.client,
          articles: commande.articles.map((a) => `${a.titre} (${a.licence}) : ${formatPrix(a.prix)}`).join('\n'),
          total: formatPrix(commande.total),
          paiement: methode,
        }),
      });
    } catch (err) { console.warn('Formspree indisponible', err); }
  }

  const lignes = detail.lignes;
  viderPanier();
  confirmer(commande, lignes);
});

function messageWhatsApp(c) {
  return `Bonjour, je souhaite commander :\n${c.articles.map((a) => `• ${a.titre} — ${a.licence} : ${formatPrix(a.prix)}`).join('\n')}\n\nTotal : ${formatPrix(c.total)}\nRéférence : ${c.ref}\nNom : ${c.client.nom}\nE-mail : ${c.client.email}`;
}

function confirmer(c, lignes) {
  document.getElementById('vueCommande').hidden = true;
  const v = document.getElementById('vueConfirmation');
  v.hidden = false;
  window.scrollTo(0, 0);

  let instructions = '';
  let action = '';
  if (c.methode === 'carte') {
    const lien = (lignes.length === 1 && lignes[0].projet.lienPaiement) || CONFIG.stripeLienGeneral;
    const url = new URL(lien);
    url.searchParams.set('prefilled_email', c.client.email);
    url.searchParams.set('client_reference_id', c.ref);
    instructions = `<p>Vous allez être redirigé vers la page de paiement sécurisée. Montant à régler : <b>${formatPrix(c.total)}</b>.</p>`;
    action = `<a class="btn" href="${esc(url.toString())}">Payer ${formatPrix(c.total)} par carte</a>`;
    setTimeout(() => { location.href = url.toString(); }, 2500);
  } else if (c.methode === 'mobile') {
    instructions = `<p>Envoyez <b>${formatPrix(c.total)}</b> sur l'un des comptes suivants en indiquant la référence <span class="ref">${esc(c.ref)}</span> :</p>
      <ul class="liste-coche">${CONFIG.mobileMoney.map((m) => `<li><b>${esc(m.operateur)}</b> : <code>${esc(m.numero)}</code> (${esc(m.titulaire)})</li>`).join('')}</ul>
      <p style="margin-top:1rem">Envoyez ensuite la capture de la transaction par WhatsApp ou e-mail pour recevoir vos plans.</p>`;
    if (CONFIG.whatsapp) action = `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(messageWhatsApp(c) + '\n\nJe viens d\'effectuer le paiement Mobile Money.')}">Envoyer la preuve sur WhatsApp</a>`;
  } else if (c.methode === 'virement') {
    const b = CONFIG.banque;
    instructions = `<p>Effectuez un virement de <b>${formatPrix(c.total)}</b> avec la référence <span class="ref">${esc(c.ref)}</span> :</p>
      <table class="tab"><tr><td>Banque</td><td>${esc(b.banque)}</td></tr><tr><td>Titulaire</td><td>${esc(b.titulaire)}</td></tr><tr><td>IBAN</td><td><code>${esc(b.iban)}</code></td></tr><tr><td>BIC / SWIFT</td><td><code>${esc(b.swift)}</code></td></tr></table>`;
    action = `<a class="btn" href="mailto:${esc(CONFIG.email)}?subject=${encodeURIComponent('Virement commande ' + c.ref)}&body=${encodeURIComponent(messageWhatsApp(c))}">Envoyer l'avis de virement par e-mail</a>`;
  } else if (c.methode === 'whatsapp') {
    instructions = `<p>Votre commande est prête. Cliquez ci-dessous pour l'envoyer au concepteur sur WhatsApp et convenir du paiement.</p>`;
    action = `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(messageWhatsApp(c))}">Ouvrir WhatsApp</a>`;
  }

  v.innerHTML = `
    <div class="succes-icone">✓</div>
    <h1 style="font-size:2.8rem">Merci ${esc(c.client.nom.split(' ')[0])} !</h1>
    <p class="muted">Votre commande <span class="ref">${esc(c.ref)}</span> a bien été enregistrée.</p>
    <div class="instructions">${instructions}</div>
    <div style="display:flex;flex-wrap:wrap;gap:.7rem;margin:1.5rem 0">${action}<a class="btn discret" href="index.html#catalogue">Retour au catalogue</a></div>
    <div class="encart">
      <h4>Détail</h4>
      <table class="tab">
        ${c.articles.map((a) => `<tr><td>${esc(a.titre)} <span class="muted">· ${esc(a.licence)}</span></td><td>${formatPrix(a.prix)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td><b>${formatPrix(c.total)}</b></td></tr>
      </table>
      <p class="muted" style="margin-top:1rem;font-size:.88rem">Les fichiers seront envoyés à <b>${esc(c.client.email)}</b> dès réception du paiement.</p>
    </div>`;
}

rendre();
