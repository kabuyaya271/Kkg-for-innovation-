import { CONFIG } from './config.js';
import { getProjets, formatPrix } from './store.js';
import { initialiserPage, carteProjet, esc, LIBELLES_TYPE, toast } from './ui.js';
import { Visionneuse, vignette } from './viewer.js';

initialiserPage('catalogue');

const etat = { type: 'tous', recherche: '', tri: 'vedette' };
const vignettes = new Map();

function imageDe(p) {
  if (p.images?.length) return p.images[0];
  if (!vignettes.has(p.id)) vignettes.set(p.id, vignette(p.modele));
  return vignettes.get(p.id);
}

async function demarrer() {
  let projets;
  try { projets = await getProjets(); } catch (e) {
    document.getElementById('grille').innerHTML = `<div class="vide">Impossible de charger les projets. Ouvrez le site via un serveur web (voir README).</div>`;
    return;
  }
  document.getElementById('nbProjets').textContent = projets.length;

  // ----- Héros 3D : fait défiler les projets à la une -----
  const vedettes = projets.filter((p) => p.vedette);
  const liste = vedettes.length ? vedettes : projets.slice(0, 1);
  if (liste.length) {
    const v = new Visionneuse(document.getElementById('heros3d'), { rotationAuto: true, zoom: false, fond: true });
    let i = 0;
    const lien = document.getElementById('herosLien');
    const montrer = () => {
      const p = liste[i % liste.length];
      if (p.modeleGLB) v.chargerGLB(p.modeleGLB).catch(() => v.afficherProjet(p.modele));
      else v.afficherProjet(p.modele);
      lien.textContent = `${p.titre} — dès ${formatPrix(p.prix)} →`;
      lien.href = `projet.html?id=${encodeURIComponent(p.id)}`;
      document.getElementById('herosLegende').hidden = false;
      i++;
    };
    montrer();
    if (liste.length > 1) setInterval(montrer, 9000);
  }

  // ----- Filtres -----
  const types = ['tous', ...new Set(projets.map((p) => p.modele?.type).filter(Boolean))];
  const zf = document.getElementById('filtresType');
  zf.innerHTML = types.map((t) => `<button class="puce ${t === 'tous' ? 'actif' : ''}" data-type="${t}">${t === 'tous' ? 'Tous' : esc(LIBELLES_TYPE[t] || t)}</button>`).join('');
  zf.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    etat.type = b.dataset.type;
    zf.querySelectorAll('.puce').forEach((x) => x.classList.toggle('actif', x === b));
    rendre(projets);
  });
  document.getElementById('recherche').addEventListener('input', (e) => { etat.recherche = e.target.value.toLowerCase(); rendre(projets); });
  document.getElementById('tri').addEventListener('change', (e) => { etat.tri = e.target.value; rendre(projets); });
  rendre(projets);
}

function rendre(projets) {
  let l = projets.filter((p) => (etat.type === 'tous' || p.modele?.type === etat.type)
    && (!etat.recherche || `${p.titre} ${p.resume} ${p.style} ${p.categorie}`.toLowerCase().includes(etat.recherche)));
  const tris = {
    vedette: (a, b) => (b.vedette - a.vedette) || (b.nouveau - a.nouveau),
    'prix-asc': (a, b) => a.prix - b.prix,
    'prix-desc': (a, b) => b.prix - a.prix,
    'surface-desc': (a, b) => b.surface - a.surface,
  };
  l = [...l].sort(tris[etat.tri]);
  document.getElementById('grille').innerHTML = l.length
    ? l.map((p) => carteProjet(p, imageDe(p), formatPrix)).join('')
    : '<div class="vide">Aucun projet ne correspond à votre recherche.</div>';
}

// ----- Licences -----
document.getElementById('blocsLicences').innerHTML = Object.entries(CONFIG.licences).map(([k, l], i) => `
  <div class="bloc-info ${i === 1 ? 'vedette' : ''}">
    <h3>${esc(l.nom)}</h3>
    <p class="prix" style="margin-bottom:.6rem">${l.multiplicateur === 1 ? 'Prix de base' : '× ' + l.multiplicateur.toLocaleString('fr-FR')}</p>
    <p class="muted">${esc(l.description)}</p>
  </div>`).join('');

// ----- Contact -----
document.getElementById('contactInfos').innerHTML = `
  <b>E-mail :</b> <a href="mailto:${esc(CONFIG.email)}">${esc(CONFIG.email)}</a><br>
  <b>Téléphone :</b> ${esc(CONFIG.telephone)}<br>
  ${CONFIG.whatsapp ? `<b>WhatsApp :</b> <a href="https://wa.me/${esc(CONFIG.whatsapp)}" target="_blank" rel="noopener">écrire un message</a><br>` : ''}
  <b>Adresse :</b> ${esc(CONFIG.adresse)}`;

document.getElementById('formContact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = {
    nom: document.getElementById('cNom').value,
    telephone: document.getElementById('cTel').value,
    email: document.getElementById('cEmail').value,
    message: document.getElementById('cMsg').value,
  };
  if (CONFIG.formspree) {
    try {
      const r = await fetch(CONFIG.formspree, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: 'Demande de projet sur mesure', ...d }) });
      if (!r.ok) throw new Error();
      toast('Merci ! Votre demande a bien été envoyée.');
      e.target.reset();
      return;
    } catch { toast("L'envoi a échoué, ouverture de votre messagerie…", 'err'); }
  }
  const corps = `Nom : ${d.nom}\nTéléphone : ${d.telephone}\nE-mail : ${d.email}\n\n${d.message}`;
  location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Demande de projet sur mesure')}&body=${encodeURIComponent(corps)}`;
});

demarrer();
