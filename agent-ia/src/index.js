// =====================================================================
//  KKG for Innovation — Agent IA + boîte aux requêtes (Cloudflare Worker)
//
//  POST  /chat              conversation avec l'assistant
//  POST  /requetes          dépôt d'une requête ou d'une commande (formulaires du site)
//  GET   /requetes          liste des requêtes        (Authorization: Bearer ADMIN_TOKEN)
//  PATCH /requetes/:cle     changer le statut / note  (Authorization: Bearer ADMIN_TOKEN)
// =====================================================================
import Anthropic from '@anthropic-ai/sdk';
import { ENTREPRISE } from './connaissances.js';

const MODELE = 'claude-opus-5-5';
const TYPES_REQUETE = ['sur-mesure', 'adaptation', 'question', 'reclamation', 'commande'];
const MAX_MESSAGES = 30;
const MAX_CARACTERES_MESSAGE = 4000;
const MAX_TAILLE_REQUETE = 30_000;

// ---------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const cors = enTetesCors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const repondre = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });

    try {
      if (url.pathname === '/chat' && request.method === 'POST') {
        if (limiteAtteinte(request)) return repondre({ erreur: 'Trop de messages. Réessayez dans une minute.' }, 429);
        return repondre(await discuter(await lireJson(request, 60_000), env));
      }
      if (url.pathname === '/requetes' && request.method === 'POST') {
        if (limiteAtteinte(request)) return repondre({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, 429);
        const req = await enregistrerRequete(await lireJson(request, MAX_TAILLE_REQUETE), env, ctx);
        return repondre({ ok: true, ref: req.ref }, 201);
      }
      if (url.pathname === '/requetes' && request.method === 'GET') {
        if (!autorise(request, env)) return repondre({ erreur: 'Non autorisé' }, 401);
        return repondre(await listerRequetes(env));
      }
      if (url.pathname.startsWith('/requetes/') && request.method === 'PATCH') {
        if (!autorise(request, env)) return repondre({ erreur: 'Non autorisé' }, 401);
        const cle = decodeURIComponent(url.pathname.slice('/requetes/'.length));
        return repondre(await modifierRequete(cle, await lireJson(request, 5_000), env));
      }
      if (url.pathname === '/' ) return repondre({ service: 'KKG for Innovation — agent IA', ok: true });
      return repondre({ erreur: 'Introuvable' }, 404);
    } catch (e) {
      if (e instanceof ErreurClient) return repondre({ erreur: e.message }, e.status);
      console.error(e);
      return repondre({ erreur: 'Erreur interne' }, 500);
    }
  },
};

class ErreurClient extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ---------------------------------------------------------------------
//  Sécurité de base
// ---------------------------------------------------------------------
function enTetesCors(request, env) {
  const origine = request.headers.get('Origin') || '';
  const autorisees = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const ok = autorisees.includes('*') || autorisees.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine);
  return {
    'Access-Control-Allow-Origin': ok ? (origine || '*') : autorisees[0],
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function autorise(request, env) {
  const attendu = env.ADMIN_TOKEN || '';
  const recu = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!attendu || recu.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ recu.charCodeAt(i);
  return diff === 0;
}

// Limite simple par adresse IP (au mieux, par instance). Pour une protection
// forte, ajoutez une règle « Rate limiting » dans le tableau de bord Cloudflare.
const compteurs = new Map();
function limiteAtteinte(request, max = 20) {
  const ip = request.headers.get('CF-Connecting-IP') || 'inconnu';
  const minute = Math.floor(Date.now() / 60_000);
  const cle = `${ip}:${minute}`;
  const n = (compteurs.get(cle) || 0) + 1;
  compteurs.set(cle, n);
  if (compteurs.size > 5000) compteurs.clear();
  return n > max;
}

async function lireJson(request, max) {
  const texte = await request.text();
  if (texte.length > max) throw new ErreurClient('Contenu trop volumineux', 413);
  try { return JSON.parse(texte); } catch { throw new ErreurClient('JSON invalide'); }
}

// ---------------------------------------------------------------------
//  Boîte aux requêtes (Cloudflare KV)
// ---------------------------------------------------------------------
function nouvelleRef(prefixe = 'REQ') {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefixe}-${ymd}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

async function enregistrerRequete(donnees, env, ctx) {
  if (!donnees || typeof donnees !== 'object') throw new ErreurClient('Requête vide');
  const type = TYPES_REQUETE.includes(donnees.type) ? donnees.type : 'question';
  const ref = typeof donnees.ref === 'string' && /^[A-Z]{3}-\d{8}-[A-Z0-9]{4}$/.test(donnees.ref)
    ? donnees.ref : nouvelleRef(type === 'commande' ? 'KKG' : 'REQ');
  const requete = {
    ...donnees,
    type,
    ref,
    statut: type === 'commande' ? 'en attente' : 'nouvelle',
    recueLe: new Date().toISOString(),
  };
  const cle = `req:${String(9e15 - Date.now()).padStart(16, '0')}:${ref}`; // ordre : plus récentes d'abord
  await env.REQUETES.put(cle, JSON.stringify(requete));

  if (env.FORMSPREE_URL) {
    ctx?.waitUntil?.(fetch(env.FORMSPREE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: `[${type}] ${ref} — ${requete.client?.nom || ''}`, contenu: JSON.stringify(requete, null, 2) }),
    }).catch((e) => console.error('Formspree', e)));
  }
  return { ...requete, cle };
}

async function listerRequetes(env) {
  const { keys } = await env.REQUETES.list({ prefix: 'req:', limit: 200 });
  const valeurs = await Promise.all(keys.map(async (k) => {
    const v = await env.REQUETES.get(k.name, 'json');
    return v ? { ...v, cle: k.name } : null;
  }));
  return valeurs.filter(Boolean);
}

async function modifierRequete(cle, changements, env) {
  if (!cle.startsWith('req:')) throw new ErreurClient('Clé invalide');
  const actuelle = await env.REQUETES.get(cle, 'json');
  if (!actuelle) throw new ErreurClient('Requête introuvable', 404);
  const maj = { ...actuelle };
  if (typeof changements.statut === 'string') maj.statut = changements.statut.slice(0, 40);
  if (typeof changements.note === 'string') maj.note = changements.note.slice(0, 2000);
  maj.modifieeLe = new Date().toISOString();
  await env.REQUETES.put(cle, JSON.stringify(maj));
  return { ok: true };
}

// ---------------------------------------------------------------------
//  Catalogue (lu depuis le site, mis en cache 10 minutes)
// ---------------------------------------------------------------------
let catalogueCache = { texte: '', expire: 0 };

async function catalogue(env) {
  if (catalogueCache.texte && Date.now() < catalogueCache.expire) return catalogueCache.texte;
  let texte = 'Catalogue momentanément indisponible : invitez le client à consulter le site.';
  try {
    const r = await fetch(`${env.SITE_URL.replace(/\/$/, '')}/data/projets.json`);
    if (r.ok) {
      const projets = await r.json();
      texte = projets.map((p) => {
        const ref = p.statut === 'reference';
        const prix = ref ? 'non vendu tel quel (réalisation sur mesure) — projet similaire sur devis'
          : Object.values(ENTREPRISE.licences).map((l) => `${l.nom} ${Math.round(p.prix * l.multiplicateur)} ${ENTREPRISE.devise}`).join(' / ');
        return [
          `### ${p.titre} (id: ${p.id})`,
          `Lien : ${env.SITE_URL}/projet.html?id=${p.id}`,
          `Type : ${p.modele?.type || p.categorie} — Style : ${p.style || '-'} — Niveaux : ${p.etages}`,
          `Surface : ${p.surface} m² — Chambres : ${p.chambres} — SdB : ${p.sallesDeBain} — Terrain min. : ${p.terrain || '-'}`,
          `Budget de construction estimé (indicatif) : ${p.budgetEstime || '-'} — Durée chantier (indicative) : ${p.delaiConstruction || '-'}`,
          `Prix : ${prix}`,
          `Résumé : ${p.resume || ''}`,
          p.caracteristiques?.length ? `Caractéristiques : ${p.caracteristiques.join(', ')}` : '',
        ].filter(Boolean).join('\n');
      }).join('\n\n');
    }
  } catch (e) { console.error('catalogue', e); }
  catalogueCache = { texte, expire: Date.now() + 10 * 60_000 };
  return texte;
}

function instructions(catalogueTexte) {
  const e = ENTREPRISE;
  return `Tu es l'assistant en ligne de ${e.nom}, ${e.activite}, basé à ${e.siege}. Tu parles aux visiteurs du site : particuliers, investisseurs, entrepreneurs, souvent en RD Congo et en Afrique centrale.

Ton rôle :
1. Renseigner sur les plans du catalogue (contenu, prix, licences, différences entre projets) et orienter vers le plan qui correspond au besoin.
2. Expliquer les services : vente de plans, projets sur mesure, adaptation d'un plan à un terrain et à son environnement.
3. Aider le visiteur à formuler sa demande, puis l'enregistrer dans la boîte aux requêtes avec l'outil enregistrer_requete.
4. Aider à résoudre un problème (commande, fichier, paiement, question technique générale) ou le transmettre au concepteur.

Règles commerciales (à respecter strictement) :
- Licences : ${Object.values(e.licences).map((l) => `${l.nom} (prix de base × ${l.multiplicateur}) : ${l.contenu}`).join(' ; ')}.
- Projets sur mesure et adaptations : sur devis écrit (valable ${e.surMesure.validiteDevisJours} jours). Le travail commence après acceptation du devis ET versement d'un acompte de ${e.surMesure.acomptePourcent} % ; le solde est payé à la validation finale, avant la remise des fichiers définitifs. ${e.surMesure.revisionsIncluses} séries de modifications sont incluses.
- Les plans restent la propriété intellectuelle de ${e.nom} ; le client reçoit une licence (une construction, sauf Exclusivité).
- Paiements : ${e.paiements}. Rappelle qu'il ne faut payer QUE sur les canaux officiels affichés sur le site.
- Contact humain : WhatsApp ${e.whatsapp}${e.email ? `, e-mail ${e.email}` : ''}.

Limites (très important) :
- Tu n'es pas un humain : si on te le demande, dis que tu es un assistant IA.
- Tu ne fixes JAMAIS de prix pour un projet sur mesure ou une adaptation, tu n'accordes aucune remise, aucun délai ferme, aucun remboursement et tu ne prends aucun engagement : seul le concepteur le fait par devis ou message écrit. Tu peux dire que le budget de construction et les prix du catalogue sont indicatifs.
- Tu ne donnes pas d'avis définitif sur la structure, les fondations, le sol ou la conformité réglementaire : rappelle qu'une étude de sol, un ingénieur structure et, si la réglementation l'exige, un architecte agréé local doivent intervenir.
- Ne demande jamais de mot de passe, code PIN ou code de transaction. Si on te signale un paiement sur un autre numéro que le numéro officiel, recommande de ne pas payer et enregistre une requête de type "reclamation".
- Détails réservés : la description architecturale détaillée, les cotes, l'emprise, le tableau des surfaces pièce par pièce et les notes techniques ne sont communiqués qu'après paiement, avec les plans. Tu ne les connais pas : ne les invente jamais et ne fais pas de suppositions chiffrées sur l'aménagement intérieur ; explique qu'ils sont remis à l'acheteur après paiement.
- Reste dans le sujet (construction, plans, services de ${e.nom}). Pour le reste, réponds brièvement et poliment que ce n'est pas ton domaine.

Enregistrement d'une requête :
- Avant d'appeler enregistrer_requete, il te faut au minimum le nom et le numéro de téléphone/WhatsApp, et pour un projet : le lieu du terrain et une description du besoin (dimensions du terrain, type de bâtiment, niveaux, chambres, budget, style, contraintes de l'environnement : pente, climat, accès, orientation).
- Pose les questions manquantes par petits groupes (2 ou 3 à la fois), sans interrogatoire.
- Récapitule la demande et demande la confirmation du visiteur AVANT d'enregistrer. N'enregistre qu'une fois par demande.
- Après l'enregistrement, donne la référence, explique la suite (le concepteur recontacte, envoie un devis ; acompte de ${e.surMesure.acomptePourcent} % pour démarrer) et invite à envoyer photos du terrain ou plan de parcelle par WhatsApp en citant la référence.

Style : français clair et chaleureux, phrases courtes, adapté à une lecture sur téléphone. Réponds en 1 à 6 phrases ou une courte liste ; pas de longs paragraphes. Réponds dans la langue du visiteur s'il écrit dans une autre langue (lingala, swahili, anglais…). Quand tu cites un plan, donne son lien.

Catalogue actuel :
${catalogueTexte}`;
}

const OUTILS = [{
  name: 'enregistrer_requete',
  description: "Enregistre la demande du visiteur dans la boîte aux requêtes du concepteur, qui le recontactera. À utiliser seulement après avoir récapitulé la demande et obtenu l'accord du visiteur. Retourne la référence de la requête.",
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['type', 'nom', 'telephone', 'email', 'lieu', 'projet_reference', 'resume', 'details'],
    properties: {
      type: { type: 'string', enum: ['sur-mesure', 'adaptation', 'question', 'reclamation'], description: 'Nature de la demande' },
      nom: { type: 'string', description: 'Nom complet du visiteur' },
      telephone: { type: 'string', description: 'Téléphone ou WhatsApp' },
      email: { type: 'string', description: 'E-mail, ou chaîne vide si non communiqué' },
      lieu: { type: 'string', description: 'Ville / pays du terrain, ou chaîne vide' },
      projet_reference: { type: 'string', description: "Id du plan du catalogue concerné, ou chaîne vide" },
      resume: { type: 'string', description: 'Résumé de la demande en une phrase' },
      details: { type: 'string', description: 'Tous les détails utiles recueillis (terrain, environnement, besoins, budget, délai, problème rencontré…)' },
    },
  },
}];

// ---------------------------------------------------------------------
//  Conversation
// ---------------------------------------------------------------------
function validerHistorique(corps) {
  const msgs = Array.isArray(corps?.messages) ? corps.messages.slice(-MAX_MESSAGES) : [];
  const propres = msgs
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MESSAGE) }));
  while (propres.length && propres[0].role !== 'user') propres.shift();
  if (!propres.length || propres[propres.length - 1].role !== 'user') throw new ErreurClient('Le dernier message doit venir du visiteur');
  // fusionne les messages consécutifs du même rôle
  return propres.reduce((acc, m) => {
    const prec = acc[acc.length - 1];
    if (prec && prec.role === m.role) prec.content += `\n\n${m.content}`;
    else acc.push({ ...m });
    return acc;
  }, []);
}

async function discuter(corps, env) {
  if (!env.ANTHROPIC_API_KEY) throw new ErreurClient("L'assistant n'est pas encore configuré.", 503);
  const messages = validerHistorique(corps);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  const system = [{ type: 'text', text: instructions(await catalogue(env)), cache_control: { type: 'ephemeral' } }];
  const contactHumain = `Vous pouvez joindre directement le concepteur sur WhatsApp au ${ENTREPRISE.whatsapp}.`;
  let refCreee = null;

  for (let tour = 0; tour < 4; tour++) {
    let reponse;
    try {
      reponse = await client.beta.messages.create({
        model: MODELE,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system,
        tools: OUTILS,
        messages,
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ErreurClient(`L'assistant est très sollicité. ${contactHumain}`, 429);
      if (e instanceof Anthropic.AuthenticationError) { console.error('Clé API invalide'); throw new ErreurClient(`Assistant indisponible. ${contactHumain}`, 503); }
      if (e instanceof Anthropic.APIError) { console.error('API', e.status, e.message); throw new ErreurClient(`Assistant momentanément indisponible. ${contactHumain}`, 502); }
      throw e;
    }

    if (reponse.stop_reason === 'refusal') {
      return { reponse: `Je ne peux pas répondre à cette demande. ${contactHumain}`, requete: refCreee };
    }

    if (reponse.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: reponse.content });
      const resultats = [];
      for (const bloc of reponse.content) {
        if (bloc.type !== 'tool_use') continue;
        if (bloc.name !== 'enregistrer_requete') {
          resultats.push({ type: 'tool_result', tool_use_id: bloc.id, content: 'Outil inconnu', is_error: true });
          continue;
        }
        const d = bloc.input || {};
        if (!d.nom?.trim() || !d.telephone?.trim()) {
          resultats.push({ type: 'tool_result', tool_use_id: bloc.id, content: 'Nom et téléphone obligatoires : demande-les au visiteur.', is_error: true });
          continue;
        }
        if (refCreee) {
          resultats.push({ type: 'tool_result', tool_use_id: bloc.id, content: `Déjà enregistrée sous la référence ${refCreee}.` });
          continue;
        }
        const req = await enregistrerRequete({
          type: d.type,
          source: 'assistant',
          client: { nom: d.nom, telephone: d.telephone, email: d.email, lieu: d.lieu },
          projetReference: d.projet_reference ? { id: d.projet_reference } : null,
          resume: d.resume,
          description: d.details,
          conversation: messages
            .filter((m) => typeof m.content === 'string')
            .map((m) => `${m.role === 'user' ? 'Visiteur' : 'Assistant'} : ${m.content}`).join('\n').slice(-12_000),
        }, env);
        refCreee = req.ref;
        resultats.push({ type: 'tool_result', tool_use_id: bloc.id, content: `Requête enregistrée. Référence : ${req.ref}` });
      }
      messages.push({ role: 'user', content: resultats });
      continue;
    }

    const texte = reponse.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { reponse: texte || `Pouvez-vous reformuler ? ${contactHumain}`, requete: refCreee };
  }
  return { reponse: `Je n'ai pas pu terminer. ${contactHumain}`, requete: refCreee };
}
