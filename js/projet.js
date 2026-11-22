import { CONFIG } from './config.js';
import { getProjets, formatPrix, prixLicence, ajouterAuPanier, getPanier } from './store.js';
import { initialiserPage, esc, carteProjet, toast, LIBELLES_TYPE, estReference, lienWhatsApp } from './ui.js';
import { Visionneuse, vignette } from './viewer.js';
import { Visite } from './visite.js?v=5';

initialiserPage();

const id = new URLSearchParams(location.search).get('id');

async function demarrer() {
  const projets = await getProjets();
  const p = projets.find((x) => x.id === id);
  if (!p) {
    document.getElementById('contenu').innerHTML = `<div class="vide" style="margin:80px 0">Projet introuvable. <a href="index.html#catalogue" style="color:var(--or)">Retour au catalogue</a></div>`;
    return;
  }
  document.title = `${p.titre} — ${CONFIG.nomSite}`;
  document.getElementById('filTitre').textContent = p.titre;

  // ---------------- 3D ----------------
  const v = new Visionneuse(document.getElementById('cible3d'));
  const charg = document.getElementById('chargement');
  const afficher3D = async () => {
    if (p.modeleGLB) {
      try { await v.chargerGLB(p.modeleGLB); } catch (e) {
        console.warn('GLB introuvable, maquette générée utilisée', e);
        v.afficherProjet(p.modele);
      }
    } else v.afficherProjet(p.modele);
    charg.hidden = true;
    if (Visite.disponible(v.modele)) {
      document.querySelector('.bouton-visite').hidden = false;
      const go = document.createElement('button'); go.className = 'visite-depart'; go.textContent = '▶ Entrer dans la maison';
      go.addEventListener('click', () => document.querySelector('.bouton-visite').click());
      document.getElementById('scene').appendChild(go);
    }
  };
  afficher3D();
  let visite = null;

  const scene = document.getElementById('scene');
  const etat = { rotation: false, nuit: false, filaire: false };
  scene.querySelector('.barre-3d').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a in etat) { etat[a] = !etat[a]; b.classList.toggle('actif', etat[a]); }
    if (a === 'visite') {
      visite ||= new Visite(v, scene); window.__visite = visite;
      visite.onSortie = () => scene.querySelector('.bouton-visite').classList.remove('actif');
      if (visite.actif) visite.desactiver(); else { v.controls.autoRotate = false; visite.activer(); b.classList.add('actif'); }
      return;
    }
    if (a === 'rotation') v.controls.autoRotate = etat.rotation;
    if (a === 'nuit') v.definirNuit(etat.nuit);
    if (a === 'filaire') v.definirFilaire(etat.filaire);
    if (a === 'dessus') v.vueDessus();
    if (a === 'facade') v.vueFacade();
    if (a === 'reinit') v.cadrer();
    if (a === 'plein') {
      if (document.fullscreenElement) document.exitFullscreen(); else scene.requestFullscreen?.();
    }
    if (a === 'capture') {
      const lien = document.createElement('a');
      lien.href = v.capture(1600);
      lien.download = `${p.id}-3d.jpg`;
      lien.click();
    }
  });
  document.getElementById('eclatement').addEventListener('input', (e) => v.definirEclatement(+e.target.value));

  // Miniatures : 3D + images de la galerie
  const imgs = p.images || [];
  const mini = document.getElementById('miniatures');
  const vi = document.getElementById('visionneuseImage');
  if (imgs.length) {
    mini.innerHTML = `<button class="actif" data-i="-1">Maquette 3D</button>` + imgs.map((src, i) => `<button data-i="${i}"><img src="${esc(src)}" alt="Image ${i + 1}"></button>`).join('');
    mini.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      mini.querySelectorAll('button').forEach((x) => x.classList.toggle('actif', x === b));
      const i = +b.dataset.i;
      vi.hidden = i < 0;
      if (i >= 0) vi.style.backgroundImage = `url("${imgs[i]}")`;
    });
  }

  // ---------------- Achat ----------------
  const zoneAchat = document.getElementById('achat');
  const entete = `
    <span class="style">${esc(p.style || '')} · ${esc(LIBELLES_TYPE[p.modele?.type] || p.categorie || '')}</span>
    <h1>${esc(p.titre)}</h1>
    <p class="muted">${esc(p.resume)}</p>`;
  const lienQuestion = CONFIG.whatsapp
    ? `<a class="btn discret bloc" target="_blank" rel="noopener" href="${lienWhatsApp(`Bonjour, j'ai une question sur le plan « ${p.titre} » : ${location.href}`)}">Poser une question sur WhatsApp</a>` : '';

  if (estReference(p) || p.exemple) {
    zoneAchat.innerHTML = `${entete}
      <div class="alerte" style="margin:1.2rem 0">${p.exemple
        ? "Ce projet est un <b>exemple</b> de ce que nous concevons. Il n'est pas vendu tel quel, mais nous pouvons concevoir pour vous un projet de ce type, adapté à votre terrain et à votre budget."
        : "Ce projet a été <b>conçu sur mesure</b> pour un client. Il n'est pas vendu tel quel, mais nous pouvons concevoir pour vous un projet similaire, adapté à votre terrain."}</div>
      <div class="actions">
        <a class="btn bloc" href="sur-mesure.html?type=similaire&projet=${encodeURIComponent(p.id)}">Commander un projet similaire</a>
        <button class="btn contour bloc" type="button" data-ouvrir-assistant>Discuter avec l'assistant</button>
        ${lienQuestion}
      </div>
      <ul class="garanties"><li>Devis gratuit et sans engagement</li><li>Démarrage avec un acompte de ${CONFIG.surMesure.acomptePourcent} %</li><li>${CONFIG.surMesure.revisionsIncluses} séries de modifications incluses</li></ul>`;
  } else {
    const options = Object.entries(CONFIG.licences).map(([k, l], i) => `
      <label class="option">
        <input type="radio" name="licence" value="${k}" ${i === 0 ? 'checked' : ''}>
        <b>${esc(l.nom)}</b><span class="p">${formatPrix(prixLicence(p, k))}</span>
        <small>${esc(l.description)}</small>
      </label>`).join('');
    zoneAchat.innerHTML = `${entete}
      <div class="options-licence">${options}</div>
      <div class="actions">
        <button class="btn bloc" id="acheter">Acheter maintenant</button>
        <button class="btn contour bloc" id="ajouter">Ajouter au panier</button>
        <a class="btn discret bloc" href="sur-mesure.html?type=adaptation&projet=${encodeURIComponent(p.id)}">Adapter ce plan à mon terrain</a>
        ${lienQuestion}
      </div>
      <ul class="garanties">
        <li>Fichiers livrés sous 24 h après paiement</li>
        <li>Paiement Mobile Money ou WhatsApp</li>
        <li>Adaptation à votre terrain sur devis</li>
        <li><a href="conditions.html#licence" style="text-decoration:underline">Conditions de la licence</a></li>
      </ul>`;
    const licence = () => document.querySelector('input[name=licence]:checked').value;
    document.getElementById('ajouter').addEventListener('click', () => {
      const deja = getPanier().some((i) => i.id === p.id);
      ajouterAuPanier(p.id, licence());
      toast(`${deja ? 'Licence mise à jour' : 'Ajouté au panier'} : <b>${esc(p.titre)}</b> — <a href="panier.html">Voir le panier</a>`);
    });
    document.getElementById('acheter').addEventListener('click', () => {
      ajouterAuPanier(p.id, licence());
      location.href = 'panier.html';
    });
  }

  // ---------------- Détails ----------------
  const stats = [
    [p.surface + ' m²', 'Surface habitable'],
    [p.etages > 1 ? `R+${p.etages - 1}` : 'Plain-pied', 'Niveaux'],
    [p.chambres, 'Chambres'],
    [p.sallesDeBain, 'Salles de bain'],
    [p.terrain, 'Terrain'],
    [p.budgetEstime, 'Budget estimé'],
    [p.delaiConstruction, 'Durée chantier'],
  ].filter(([v]) => v !== undefined && v !== '' && v !== null);
  document.getElementById('stats').innerHTML = stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  document.getElementById('description').textContent = p.description || '';
  document.getElementById('caracteristiques').innerHTML = (p.caracteristiques || []).map((c) => `<li>${esc(c)}</li>`).join('');
  document.getElementById('inclus').innerHTML = (p.inclus || []).map((c) => `<li>${esc(c)}</li>`).join('');
  document.getElementById('verrouActions').innerHTML = estReference(p) || p.exemple
    ? `<a class="btn" href="sur-mesure.html?type=similaire&projet=${encodeURIComponent(p.id)}">Commander un projet similaire</a>`
    : `<a class="btn" href="#achat">Choisir ma licence</a><button class="btn discret" type="button" data-ouvrir-assistant>Poser une question</button>`;

  // ---------------- Similaires ----------------
  const autres = projets.filter((x) => x.id !== p.id)
    .sort((a, b) => (b.modele?.type === p.modele?.type) - (a.modele?.type === p.modele?.type) || Math.abs(a.prix - p.prix) - Math.abs(b.prix - p.prix))
    .slice(0, 3);
  document.getElementById('similaires').innerHTML = autres
    .map((x) => carteProjet(x, x.images?.[0] || vignette(x.modele), formatPrix)).join('');
}

demarrer();
