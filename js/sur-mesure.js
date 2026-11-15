import { CONFIG } from './config.js';
import { getProjets, transmettre, genererRefRequete } from './store.js';
import { initialiserPage, esc, toast, blocContacts, lienWhatsApp, blocConfidentialite } from './ui.js';

initialiserPage('sur-mesure');

const sm = CONFIG.surMesure;
const valeurs = { acompte: sm.acomptePourcent, revisions: sm.revisionsIncluses, validite: sm.validiteDevisJours, societe: CONFIG.entreprise.raisonSociale };
document.querySelectorAll('[data-cfg]').forEach((e) => { e.textContent = valeurs[e.dataset.cfg]; });
document.getElementById('contactsSM').innerHTML = blocContacts();
document.querySelector('[data-confidentialite]').innerHTML = blocConfidentialite();

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

async function demarrer() {
  const projets = await getProjets().catch(() => []);
  $('projet').innerHTML += projets.map((p) => `<option value="${esc(p.id)}">${esc(p.titre)}</option>`).join('');

  const typeInitial = params.get('type');
  if (typeInitial) {
    const r = document.querySelector(`input[name=type][value="${CSS.escape(typeInitial)}"]`);
    if (r) r.checked = true;
  }
  if (params.get('projet')) $('projet').value = params.get('projet');
  if (typeInitial === 'similaire') {
    document.querySelector('input[name=type][value="sur-mesure"]').checked = true;
    const p = projets.find((x) => x.id === params.get('projet'));
    if (p) $('description').value = `Je souhaite un projet similaire à « ${p.titre} » (${location.origin}${location.pathname.replace(/[^/]*$/, '')}projet.html?id=${p.id}), avec les adaptations suivantes : `;
  }
  majType();
}

function typeChoisi() { return document.querySelector('input[name=type]:checked').value; }

function majType() {
  const t = typeChoisi();
  $('blocProjet').hidden = !(t === 'adaptation' || t === 'question' || $('projet').value);
  $('blocTechnique').hidden = t === 'question';
  $('projet').required = t === 'adaptation';
  $('lieu').required = t !== 'question';
}
document.getElementById('typesDemande').addEventListener('change', majType);

const LIBELLES = { 'sur-mesure': 'Projet sur mesure', adaptation: 'Adaptation de plan', question: 'Question / problème' };

$('formRequete').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = typeChoisi();
  const projets = await getProjets().catch(() => []);
  const projet = projets.find((p) => p.id === $('projet').value);
  const requete = {
    ref: genererRefRequete(),
    statut: 'nouvelle',
    source: 'formulaire',
    client: { nom: $('nom').value.trim(), telephone: $('tel').value.trim(), email: $('email').value.trim(), lieu: $('lieu').value.trim() },
    projetReference: projet ? { id: projet.id, titre: projet.titre } : null,
    besoin: t === 'question' ? null : {
      terrain: $('terrain').value.trim(), relief: $('relief').value, environnement: $('environnement').value.trim(),
      typeBatiment: $('typeBatiment').value, niveaux: $('niveaux').value, chambres: $('chambres').value, sallesDeBain: $('sdb').value,
      budget: $('budget').value.trim(), delai: $('delai').value.trim(), style: $('style').value.trim(),
    },
    description: $('description').value.trim(),
  };
  const btn = $('envoyer');
  btn.disabled = true;
  btn.textContent = 'Envoi…';
  const { distant } = await transmettre(t, requete);
  btn.disabled = false;
  btn.textContent = 'Envoyer ma requête';
  confirmer(t, requete, distant);
});

function resumeTexte(t, r) {
  const b = r.besoin || {};
  const lignes = [
    `${LIBELLES[t]} — réf. ${r.ref}`,
    `Nom : ${r.client.nom}`, `Tél : ${r.client.telephone}`, r.client.email && `E-mail : ${r.client.email}`,
    r.client.lieu && `Lieu du terrain : ${r.client.lieu}`,
    r.projetReference && `Plan concerné : ${r.projetReference.titre}`,
    b.terrain && `Terrain : ${b.terrain}`, b.relief && `Relief : ${b.relief}`, b.environnement && `Environnement : ${b.environnement}`,
    b.typeBatiment && `Bâtiment : ${b.typeBatiment} (${b.niveaux})`,
    (b.chambres || b.sallesDeBain) && `Chambres : ${b.chambres || '-'} / SdB : ${b.sallesDeBain || '-'}`,
    b.budget && `Budget : ${b.budget}`, b.delai && `Délai : ${b.delai}`, b.style && `Style : ${b.style}`,
    '', r.description,
  ];
  return lignes.filter((l) => l !== null && l !== undefined && l !== false).join('\n');
}

function confirmer(t, r, distant) {
  $('formRequete').closest('.commande').hidden = true;
  const v = $('confirmation');
  v.hidden = false;
  v.scrollIntoView({ behavior: 'smooth' });
  v.innerHTML = `
    <div class="succes-icone">✓</div>
    <h2>Requête enregistrée</h2>
    <p class="muted">Référence : <span class="ref">${esc(r.ref)}</span></p>
    <div class="instructions">
      ${distant
        ? '<p>Votre requête a bien été transmise. Nous vous recontactons rapidement par WhatsApp ou par e-mail.</p>'
        : '<p><b>Dernière étape :</b> envoyez la requête par WhatsApp pour qu\'elle nous parvienne.</p>'}
      <p>Vous pouvez aussi nous envoyer sur WhatsApp vos photos du terrain, plan de parcelle ou croquis, en rappelant la référence ci-dessus.</p>
      ${t !== 'question' ? `<p class="muted" style="font-size:.88rem">Rappel : aucun travail de conception ne commence avant l'acceptation du devis et la réception de l'acompte de ${CONFIG.surMesure.acomptePourcent} %.</p>` : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.7rem">
      ${CONFIG.whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="${lienWhatsApp(resumeTexte(t, r))}">${distant ? 'Compléter sur WhatsApp' : 'Envoyer sur WhatsApp'}</a>` : ''}
      <a class="btn discret" href="index.html#catalogue">Retour au catalogue</a>
    </div>`;
  toast('Requête enregistrée.');
}

demarrer();
