// Assistant conversationnel (bulle en bas à droite de chaque page)
import { CONFIG } from './config.js';
import { esc, lienWhatsApp } from './ui.js';

const CLE = 'kkg_chat';
let historique = [];
let enCours = false;

function lireHistorique() {
  try { return JSON.parse(sessionStorage.getItem(CLE)) || []; } catch { return []; }
}
function sauver() {
  try { sessionStorage.setItem(CLE, JSON.stringify(historique.slice(-40))); } catch { /* ignore */ }
}

// Mise en forme minimale et sûre : échappement, **gras**, liens, retours à la ligne
function formater(texte) {
  return esc(texte)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

export function initialiserAssistant() {
  if (document.querySelector('.assistant')) return;
  historique = lireHistorique();
  const actif = !!CONFIG.agentIA;

  const racine = document.createElement('div');
  racine.className = 'assistant';
  racine.innerHTML = `
    <button class="assistant-bulle" aria-label="Ouvrir l'assistant" aria-expanded="false">
      <span class="assistant-icone">💬</span><span class="assistant-libelle">Une question ?</span>
    </button>
    <div class="assistant-panneau" role="dialog" aria-label="Assistant ${esc(CONFIG.nomSite)}" hidden>
      <header>
        <div><b>Assistant ${esc(CONFIG.nomSite)}</b><small>${actif ? 'Assistant IA · disponible 24 h/24' : 'Comment pouvons-nous vous aider ?'}</small></div>
        <button class="assistant-fermer" aria-label="Fermer">✕</button>
      </header>
      <div class="assistant-fil" aria-live="polite"></div>
      <div class="assistant-suggestions"></div>
      ${actif ? `
      <form class="assistant-saisie">
        <textarea rows="1" placeholder="Écrivez votre message…" aria-label="Votre message" maxlength="2000"></textarea>
        <button class="btn" aria-label="Envoyer">➤</button>
      </form>` : ''}
      <footer>
        ${actif ? `Assistant automatisé : réponses indicatives, seul un devis écrit engage. <a href="conditions.html#assistant">En savoir plus</a> · ` : ''}
        <a href="${lienWhatsApp()}" target="_blank" rel="noopener">Parler à une personne (WhatsApp)</a>
      </footer>
    </div>`;
  document.body.appendChild(racine);

  const bulle = racine.querySelector('.assistant-bulle');
  const panneau = racine.querySelector('.assistant-panneau');
  const fil = racine.querySelector('.assistant-fil');
  const sugg = racine.querySelector('.assistant-suggestions');

  const ouvrir = (o = true) => {
    panneau.hidden = !o;
    racine.classList.toggle('ouvert', o);
    bulle.setAttribute('aria-expanded', o);
    if (o) { fil.scrollTop = fil.scrollHeight; racine.querySelector('textarea')?.focus(); }
  };
  bulle.addEventListener('click', () => ouvrir(panneau.hidden));
  racine.querySelector('.assistant-fermer').addEventListener('click', () => ouvrir(false));
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ouvrir-assistant]');
    if (b) { e.preventDefault(); ouvrir(true); }
  });

  const ajouterBulle = (role, html) => {
    const d = document.createElement('div');
    d.className = `msg ${role.split(' ').map((r) => `m-${r}`).join(' ')}`;
    d.innerHTML = html;
    fil.appendChild(d);
    fil.scrollTop = fil.scrollHeight;
    return d;
  };

  const accueil = actif
    ? `Bonjour 👋 Je suis l'assistant de ${CONFIG.nomSite}. Je peux vous aider à choisir un plan, préparer une demande de projet sur mesure ou d'adaptation à votre terrain, ou résoudre un problème. Que puis-je faire pour vous ?`
    : `Bonjour 👋 Que souhaitez-vous faire ?`;
  ajouterBulle('assistant', formater(accueil));
  historique.forEach((m) => ajouterBulle(m.role, formater(m.affichage ?? m.content)));

  // ---------- Mode sans agent IA : orientation simple ----------
  if (!actif) {
    sugg.innerHTML = `
      <a class="puce" href="index.html#catalogue">Voir les plans disponibles</a>
      <a class="puce" href="sur-mesure.html">Projet sur mesure</a>
      <a class="puce" href="sur-mesure.html?type=adaptation">Adapter un plan à mon terrain</a>
      <a class="puce" href="sur-mesure.html?type=question">Question ou problème</a>
      <a class="puce" href="${lienWhatsApp()}" target="_blank" rel="noopener">WhatsApp</a>`;
    return;
  }

  // ---------- Mode agent IA ----------
  const suggestions = ['Quel plan pour un terrain de 15 × 20 m ?', 'Je veux un projet sur mesure', 'Adapter un plan à mon terrain en pente', 'Quelle différence entre les licences ?'];
  const afficherSuggestions = () => {
    sugg.innerHTML = historique.length ? '' : suggestions.map((s) => `<button class="puce" type="button">${esc(s)}</button>`).join('');
  };
  afficherSuggestions();
  sugg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) envoyer(b.textContent); });

  const form = racine.querySelector('.assistant-saisie');
  const zone = form.querySelector('textarea');
  zone.addEventListener('input', () => { zone.style.height = 'auto'; zone.style.height = `${Math.min(zone.scrollHeight, 120)}px`; });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); envoyer(zone.value); zone.value = ''; zone.style.height = 'auto'; });

  async function envoyer(texte) {
    texte = texte.trim();
    if (!texte || enCours) return;
    enCours = true;
    // contexte de la page (ex. plan consulté) ajouté au premier message, invisible pour le visiteur
    const contexte = !historique.length && document.title ? `[Page consultée : ${document.title} — ${location.href}]\n` : '';
    historique.push({ role: 'user', content: contexte + texte, affichage: texte });
    ajouterBulle('user', formater(texte));
    afficherSuggestions();
    const attente = ajouterBulle('assistant attente', '<span></span><span></span><span></span>');
    try {
      const r = await fetch(`${CONFIG.agentIA.replace(/\/$/, '')}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historique.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await r.json().catch(() => ({}));
      attente.remove();
      if (!r.ok) throw new Error(data.erreur || 'Erreur');
      historique.push({ role: 'assistant', content: data.reponse });
      ajouterBulle('assistant', formater(data.reponse));
      if (data.requete) ajouterBulle('systeme', `Requête enregistrée : <span class="ref">${esc(data.requete)}</span>`);
      sauver();
    } catch (err) {
      attente.remove();
      historique.pop();
      ajouterBulle('systeme', `${esc(err.message || 'Connexion impossible')} — <a href="${lienWhatsApp(texte)}" target="_blank" rel="noopener">écrire sur WhatsApp</a>`);
    } finally {
      enCours = false;
    }
  }
}
