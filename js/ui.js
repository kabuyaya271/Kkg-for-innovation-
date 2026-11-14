// En-tête, pied de page, compteur du panier, notifications
import { CONFIG } from './config.js';
import { getPanier } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initialiserPage(actif = '') {
  const header = document.querySelector('[data-header]');
  if (header) {
    header.innerHTML = `
      <div class="wrap nav">
        <a href="index.html" class="logo"><span class="logo-mark">▲</span>${esc(CONFIG.nomSite)}</a>
        <button class="burger" aria-label="Menu" aria-expanded="false">☰</button>
        <nav class="liens">
          <a href="index.html#catalogue" class="${actif === 'catalogue' ? 'actif' : ''}">Catalogue</a>
          <a href="index.html#licences">Licences</a>
          <a href="index.html#processus">Comment acheter</a>
          <a href="index.html#contact">Contact</a>
          <a href="panier.html" class="btn-panier ${actif === 'panier' ? 'actif' : ''}">Panier <span class="badge" data-badge>0</span></a>
        </nav>
      </div>`;
    const burger = header.querySelector('.burger');
    burger.addEventListener('click', () => {
      const o = header.classList.toggle('ouvert');
      burger.setAttribute('aria-expanded', o);
    });
    header.querySelectorAll('.liens a').forEach((a) => a.addEventListener('click', () => header.classList.remove('ouvert')));
  }
  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="wrap pied">
        <div>
          <a href="index.html" class="logo"><span class="logo-mark">▲</span>${esc(CONFIG.nomSite)}</a>
          <p class="muted">${esc(CONFIG.slogan)}</p>
        </div>
        <div>
          <h4>Contact</h4>
          <p class="muted">${esc(CONFIG.email)}<br>${esc(CONFIG.telephone)}<br>${esc(CONFIG.adresse)}</p>
        </div>
        <div>
          <h4>Liens</h4>
          <p><a href="index.html#catalogue">Catalogue</a><br><a href="panier.html">Panier</a><br><a href="admin.html">Espace concepteur</a></p>
        </div>
      </div>
      <div class="wrap copyright muted">© ${new Date().getFullYear()} ${esc(CONFIG.concepteur)}. Tous les plans sont protégés par le droit d'auteur.</div>`;
  }
  majBadge();
  window.addEventListener('panier:change', majBadge);
  window.addEventListener('storage', majBadge);
}

function majBadge() {
  const n = getPanier().length;
  document.querySelectorAll('[data-badge]').forEach((b) => { b.textContent = n; b.hidden = n === 0; });
}

export function toast(message, type = 'ok') {
  let zone = document.querySelector('.toasts');
  if (!zone) { zone = document.createElement('div'); zone.className = 'toasts'; document.body.appendChild(zone); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = message;
  zone.appendChild(t);
  setTimeout(() => t.classList.add('sortie'), 3200);
  setTimeout(() => t.remove(), 3700);
}

export const LIBELLES_TYPE = {
  villa: 'Villa', maison: 'Maison', duplex: 'Duplex', immeuble: 'Immeuble', commercial: 'Commercial',
};

/** Carte d'un projet pour les grilles du catalogue */
export function carteProjet(p, image, formatPrix) {
  return `
    <a class="carte" href="projet.html?id=${encodeURIComponent(p.id)}">
      <div class="carte-img">
        <img src="${image}" alt="${esc(p.titre)}" loading="lazy">
        <div class="pastilles">
          ${p.nouveau ? '<span class="pastille or">Nouveau</span>' : ''}
          <span class="pastille">${esc(LIBELLES_TYPE[p.modele?.type] || p.categorie || '')}</span>
        </div>
        <span class="voir3d">Voir en 3D ↻</span>
      </div>
      <div class="carte-corps">
        <h3>${esc(p.titre)}</h3>
        <p class="muted">${esc(p.resume)}</p>
        <ul class="mini-stats">
          <li><b>${esc(p.surface)}</b> m²</li>
          <li><b>${esc(p.chambres)}</b> ch.</li>
          <li><b>${esc(p.sallesDeBain)}</b> sdb</li>
          <li><b>${p.etages > 1 ? 'R+' + (p.etages - 1) : 'Plain-pied'}</b></li>
        </ul>
        <div class="carte-pied"><span class="prix">dès ${formatPrix(p.prix)}</span><span class="fleche">→</span></div>
      </div>
    </a>`;
}
