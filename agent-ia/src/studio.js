// =====================================================================
//  Atelier de conception — postes de travail, études partagées, agents IA
//
//  POST   /studio/connexion            vérifie le code d'un poste
//  GET    /studio/postes               liste des postes            (directeur)
//  POST   /studio/postes               créer un poste → code       (directeur)
//  PATCH  /studio/postes/:id           activer / désactiver        (directeur)
//  POST   /studio/postes/:id/code      nouveau code d'accès        (directeur)
//  GET    /studio/etudes               liste des études
//  GET    /studio/etudes/:id           ouvrir une étude
//  PUT    /studio/etudes/:id           enregistrer (contrôle de version)
//  DELETE /studio/etudes/:id           supprimer                   (directeur)
//  POST   /studio/agent                consulter un agent IA spécialisé
//
//  Authentification : en-tête « Authorization: Bearer <code du poste> ».
//  Le jeton ADMIN_TOKEN ouvre le poste « Directeur ».
// =====================================================================
import Anthropic from '@anthropic-ai/sdk';
import { ENTREPRISE } from './connaissances.js';

const MODELE = 'claude-opus-5-5';
const ROLES = ['directeur', 'architecte', 'ingenieur', 'dessinateur', 'metreur'];

export class ErreurStudio extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function sha256(texte) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function codeAleatoire() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = crypto.getRandomValues(new Uint8Array(12));
  const c = [...octets].map((b) => alphabet[b % alphabet.length]).join('');
  return `KKG-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

function egal(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function identifier(request, env) {
  const code = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!code) throw new ErreurStudio('Code du poste requis', 401);
  if (egal(code, env.ADMIN_TOKEN || '')) return { id: 'directeur', nom: 'Directeur', role: 'directeur', actif: true };
  const id = await env.REQUETES.get(`postecode:${await sha256(code)}`);
  const poste = id && (await env.REQUETES.get(`poste:${id}`, 'json'));
  if (!poste || !poste.actif) throw new ErreurStudio('Code invalide ou poste désactivé', 401);
  return poste;
}

const exigerDirecteur = (p) => { if (p.role !== 'directeur') throw new ErreurStudio('Réservé au directeur', 403); };

// ---------------------------------------------------------------------
export async function routerStudio(request, env, url, { lireJson, journaliser, limiteAtteinte }) {
  const chemin = url.pathname.replace(/^\/studio/, '');
  const m = request.method;
  const poste = await identifier(request, env);
  const tracer = (evenement, ref, details) => journaliser(env, {
    evenement, ref, origine: 'concepteur', client: {}, details: { poste: `${poste.nom} (${poste.role})`, ...details },
  });

  if (chemin === '/connexion' && m === 'POST') {
    await tracer('poste.connexion', poste.id, {});
    return { poste: { id: poste.id, nom: poste.nom, role: poste.role, specialite: poste.specialite || '' } };
  }

  // ---------- Postes ----------
  if (chemin === '/postes' && m === 'GET') {
    exigerDirecteur(poste);
    const { keys } = await env.REQUETES.list({ prefix: 'poste:' });
    return (await Promise.all(keys.map((k) => env.REQUETES.get(k.name, 'json')))).filter(Boolean);
  }
  if (chemin === '/postes' && m === 'POST') {
    exigerDirecteur(poste);
    const d = await lireJson(request, 5_000);
    const nom = String(d.nom || '').trim().slice(0, 80);
    if (!nom) throw new ErreurStudio('Nom du poste requis');
    const role = ROLES.includes(d.role) && d.role !== 'directeur' ? d.role : 'architecte';
    const id = crypto.randomUUID().slice(0, 8);
    const code = codeAleatoire();
    const nouveau = { id, nom, role, specialite: String(d.specialite || '').slice(0, 120), actif: true, creeLe: new Date().toISOString() };
    await env.REQUETES.put(`poste:${id}`, JSON.stringify(nouveau));
    await env.REQUETES.put(`postecode:${await sha256(code)}`, id);
    await tracer('poste.cree', id, { nom, role });
    return { ...nouveau, code }; // le code n'est montré qu'une seule fois
  }
  let r = /^\/postes\/([\w-]+)$/.exec(chemin);
  if (r && m === 'PATCH') {
    exigerDirecteur(poste);
    const p = await env.REQUETES.get(`poste:${r[1]}`, 'json');
    if (!p) throw new ErreurStudio('Poste introuvable', 404);
    const d = await lireJson(request, 2_000);
    if (typeof d.actif === 'boolean') p.actif = d.actif;
    await env.REQUETES.put(`poste:${p.id}`, JSON.stringify(p));
    await tracer(p.actif ? 'poste.active' : 'poste.desactive', p.id, { nom: p.nom });
    return p;
  }
  r = /^\/postes\/([\w-]+)\/code$/.exec(chemin);
  if (r && m === 'POST') {
    exigerDirecteur(poste);
    const p = await env.REQUETES.get(`poste:${r[1]}`, 'json');
    if (!p) throw new ErreurStudio('Poste introuvable', 404);
    const { keys } = await env.REQUETES.list({ prefix: 'postecode:' });
    for (const k of keys) if ((await env.REQUETES.get(k.name)) === p.id) await env.REQUETES.delete(k.name);
    const code = codeAleatoire();
    await env.REQUETES.put(`postecode:${await sha256(code)}`, p.id);
    await tracer('poste.nouveau_code', p.id, { nom: p.nom });
    return { ...p, code };
  }

  // ---------- Études ----------
  if (chemin === '/etudes' && m === 'GET') {
    const { keys } = await env.REQUETES.list({ prefix: 'etude:' });
    return keys.map((k) => ({ id: k.name.slice(6), ...(k.metadata || {}) }))
      .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)));
  }
  r = /^\/etudes\/([\w-]+)$/.exec(chemin);
  if (r && m === 'GET') {
    const e = await env.REQUETES.get(`etude:${r[1]}`, 'json');
    if (!e) throw new ErreurStudio('Étude introuvable', 404);
    return e;
  }
  if (r && m === 'PUT') {
    const d = await lireJson(request, 5_000_000);
    const etude = d.etude;
    if (!etude || typeof etude !== 'object' || !Array.isArray(etude.niveaux)) throw new ErreurStudio('Étude invalide');
    const actuelle = await env.REQUETES.get(`etude:${r[1]}`, 'json');
    if (actuelle && actuelle.version !== d.version) {
      throw new ErreurStudio(`Conflit : ${actuelle.modifiePar} a enregistré une version plus récente. Rechargez l'étude avant d'enregistrer.`, 409);
    }
    const sauvegarde = { ...etude, id: r[1], version: (actuelle?.version || 0) + 1, modifieLe: new Date().toISOString(), modifiePar: poste.nom };
    delete sauvegarde.calque; // l'image de fond reste sur le poste (taille)
    await env.REQUETES.put(`etude:${r[1]}`, JSON.stringify(sauvegarde), {
      metadata: { nom: String(etude.nom || '').slice(0, 80), client: String(etude.client || '').slice(0, 80), modifieLe: sauvegarde.modifieLe, modifiePar: poste.nom, version: sauvegarde.version, niveaux: etude.niveaux.length },
    });
    await tracer('etude.enregistree', r[1], { nom: etude.nom, version: sauvegarde.version });
    return { ok: true, version: sauvegarde.version, modifieLe: sauvegarde.modifieLe };
  }
  if (r && m === 'DELETE') {
    exigerDirecteur(poste);
    await env.REQUETES.delete(`etude:${r[1]}`);
    await tracer('etude.supprimee', r[1], {});
    return { ok: true };
  }

  // ---------- Agents IA ----------
  if (chemin === '/agent' && m === 'POST') {
    if (limiteAtteinte(request, 15)) throw new ErreurStudio('Trop de demandes, patientez une minute.', 429);
    return consulterAgent(await lireJson(request, 300_000), env, poste);
  }
  throw new ErreurStudio('Introuvable', 404);
}

// =====================================================================
//  Agents spécialisés
// =====================================================================
const CONVENTIONS = `Conventions du plan : coordonnées en mètres ; x vers la droite, y vers le BAS (vue en plan, nord en haut sauf indication) ; origine en haut à gauche. Un mur est un segment (x1,y1)→(x2,y2) d'axe, avec une épaisseur. Une ouverture (porte, fenêtre, baie) est placée sur un mur par la distance de son centre depuis le début du mur. Une pièce est un polygone fermé.`;

const SOCLE = `Tu travailles dans l'atelier de conception de ${ENTREPRISE.nom} (${ENTREPRISE.siege}). Tu assistes des architectes et ingénieurs professionnels : réponds en français, de façon technique, structurée et concise (titres courts, listes, chiffres avec unités). Contexte fréquent : République Démocratique du Congo et Afrique centrale (climat tropical humide, fortes pluies, ensoleillement, maçonnerie en blocs de ciment 20 et 15 cm, béton armé, toitures tôle ou dalle ; zone sismique et volcanique au Kivu). ${CONVENTIONS}
Tu reçois le plan en cours et son métré au début du dernier message. Appuie-toi dessus et cite les éléments précis (pièces, murs, dimensions). Si une information manque, dis-le et propose une hypothèse explicite. Le professionnel garde la décision et la responsabilité : tu proposes, il valide.`;

export const AGENTS = {
  architecte: {
    nom: 'Architecte concepteur',
    effort: 'high',
    instructions: `${SOCLE}
Spécialité : conception architecturale de bâtiments de tous types (habitat individuel et collectif, commerces, bureaux, écoles, centres de santé, lieux de culte, hôtels, équipements). Programme, distribution, circulations, orientation, ventilation naturelle, éclairage, proportions, ergonomie, accessibilité, évolutivité (extension future), économie du projet.
Quand on te demande de créer ou de modifier un plan, utilise l'outil proposer_plan pour transmettre UN niveau complet et cohérent :
- murs connectés aux extrémités (coordonnées identiques aux jonctions), extérieurs 0,20 m, intérieurs 0,15 m (sauf demande contraire) ;
- ouvertures réalistes : portes 0,80-0,90 m (entrée 1,00-1,20 m), fenêtres 1,00-1,50 m avec allège ~1,00 m, baies 1,80-2,40 m ; chaque pièce de vie et chambre a au moins une fenêtre ; les ouvertures ne se chevauchent pas et restent à 0,20 m au moins des extrémités du mur ;
- pièces nommées (Séjour, Cuisine, Chambre 1, SdB, WC, Dégagement…) dont les polygones suivent les axes des murs ;
- dimensions minimales usuelles : chambre ≥ 9 m², séjour ≥ 20 m², SdB ≥ 3,5 m², largeur de couloir ≥ 0,90 m.
Après la proposition, explique brièvement les choix et les points à vérifier.`,
  },
  ingenieur: {
    nom: 'Ingénieur structure',
    effort: 'medium',
    instructions: `${SOCLE}
Spécialité : structure et géotechnique. Système porteur (portiques béton armé, maçonnerie chaînée, charpente), trame de poteaux, portées, pré-dimensionnement INDICATIF (poteaux, poutres, dalles, semelles, chaînages, linteaux) par règles de prédimensionnement usuelles (BAEL / Eurocodes), descentes de charges simplifiées, joints, dispositions parasismiques (Kivu), sols (argiles gonflantes, remblais, nappe), drainage, points de vigilance du plan (grandes portées, porte-à-faux, murs non superposés entre niveaux).
Règle absolue : présente chaque chiffre comme un ordre de grandeur de pré-dimensionnement, et rappelle que le calcul définitif et les plans d'exécution doivent être établis et signés par un ingénieur structure, sur la base d'une étude de sol.`,
  },
  metreur: {
    nom: 'Métreur-économiste',
    effort: 'medium',
    instructions: `${SOCLE}
Spécialité : métré, quantitatif et estimation des coûts. À partir du métré fourni, établis des quantitatifs par lot (terrassement, fondations, maçonnerie, béton armé, toiture, menuiseries, enduits, revêtements, plomberie, électricité, peinture), signale les quantités manquantes et estime un budget en ${ENTREPRISE.devise} avec des prix unitaires hypothétiques clairement indiqués (marché de Kinshasa / grandes villes de RDC), une fourchette basse-haute et des imprévus (10-15 %). Présente les résultats sous forme de tableaux. Précise toujours que les prix doivent être confirmés par des devis d'entreprises locales.`,
  },
  conformite: {
    nom: 'Contrôleur conformité & climat',
    effort: 'medium',
    instructions: `${SOCLE}
Spécialité : revue critique du plan. Vérifie et liste les problèmes par gravité (bloquant / important / amélioration) : pièces sans fenêtre, pièces trop petites, circulations trop étroites, accès aux pièces humides, ventilation traversante, protection solaire et pluie (débords, orientation), évacuation des eaux pluviales, sécurité incendie et évacuation (ERP), accessibilité PMR, intimité, cohérence entre niveaux, dispositions parasismiques au Kivu, règles générales d'urbanisme et de permis de bâtir en RDC (recul, emprise, hauteur — à confirmer auprès de l'urbanisme local). Pour chaque problème, propose une correction précise.`,
  },
  redacteur: {
    nom: 'Rédacteur technique & commercial',
    effort: 'medium',
    instructions: `${SOCLE}
Spécialité : rédaction. Selon la demande, rédige : (1) la présentation commerciale publique d'un plan pour le catalogue (accrocheuse, sans détail technique ni cote), (2) la description architecturale détaillée réservée aux acheteurs, (3) une notice descriptive des ouvrages, (4) une réponse professionnelle à un client. Texte prêt à copier, sans invention de caractéristiques absentes du plan.`,
  },
};

const OUTIL_PLAN = {
  name: 'proposer_plan',
  description: "Transmet à l'atelier une proposition de plan complète pour UN niveau. L'utilisateur choisira de l'appliquer ou non.",
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['nom_niveau', 'hauteur', 'murs', 'ouvertures', 'pieces', 'commentaire'],
    properties: {
      nom_niveau: { type: 'string' },
      hauteur: { type: 'number', description: 'Hauteur sous plafond + dalle, en m (ex. 3.0)' },
      murs: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['x1', 'y1', 'x2', 'y2', 'epaisseur', 'exterieur'],
          properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' }, epaisseur: { type: 'number' }, exterieur: { type: 'boolean' } },
        },
      },
      ouvertures: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['mur_index', 'position', 'largeur', 'hauteur', 'allege', 'type'],
          properties: {
            mur_index: { type: 'integer', description: 'Index (0…) du mur dans la liste murs' },
            position: { type: 'number', description: 'Distance en m du début du mur au CENTRE de l\'ouverture' },
            largeur: { type: 'number' }, hauteur: { type: 'number' }, allege: { type: 'number', description: '0 pour une porte' },
            type: { type: 'string', enum: ['porte', 'fenetre', 'baie'] },
          },
        },
      },
      pieces: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['nom', 'points'],
          properties: {
            nom: { type: 'string' },
            points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } } },
          },
        },
      },
      commentaire: { type: 'string' },
    },
  },
};

const nombre = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Validation stricte de la proposition (l'entrée streamée n'est pas validée par l'API). */
function validerPlan(p) {
  const err = [];
  if (!p || typeof p !== 'object') return ['entrée absente'];
  if (typeof p.nom_niveau !== 'string') err.push('nom_niveau');
  if (!nombre(p.hauteur, 2, 8)) err.push('hauteur (2 à 8 m)');
  if (!Array.isArray(p.murs) || !p.murs.length || p.murs.length > 400) err.push('murs');
  else p.murs.forEach((w, i) => {
    if (!['x1', 'y1', 'x2', 'y2'].every((k) => nombre(w?.[k], -500, 500)) || !nombre(w?.epaisseur, 0.05, 1) || typeof w?.exterieur !== 'boolean') err.push(`murs[${i}]`);
  });
  if (!Array.isArray(p.ouvertures) || p.ouvertures.length > 400) err.push('ouvertures');
  else p.ouvertures.forEach((o, i) => {
    if (!Number.isInteger(o?.mur_index) || o.mur_index < 0 || o.mur_index >= (p.murs?.length || 0)
      || !nombre(o.position, 0, 500) || !nombre(o.largeur, 0.3, 10) || !nombre(o.hauteur, 0.3, 6) || !nombre(o.allege, 0, 3)
      || !['porte', 'fenetre', 'baie'].includes(o.type)) err.push(`ouvertures[${i}]`);
  });
  if (!Array.isArray(p.pieces) || p.pieces.length > 200) err.push('pieces');
  else p.pieces.forEach((r, i) => {
    if (typeof r?.nom !== 'string' || !Array.isArray(r.points) || r.points.length < 3 || !r.points.every((q) => nombre(q?.x, -500, 500) && nombre(q?.y, -500, 500))) err.push(`pieces[${i}]`);
  });
  if (typeof p.commentaire !== 'string') err.push('commentaire');
  return err.slice(0, 10);
}

async function consulterAgent(corps, env, poste) {
  if (!env.ANTHROPIC_API_KEY) throw new ErreurStudio('Agents IA non configurés (clé API manquante).', 503);
  const agent = AGENTS[corps.agent];
  if (!agent) throw new ErreurStudio('Agent inconnu');
  const msgs = (Array.isArray(corps.messages) ? corps.messages : []).slice(-24)
    .filter((x) => (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string' && x.content.trim())
    .map((x) => ({ role: x.role, content: x.content.slice(0, 20_000) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new ErreurStudio('Le dernier message doit venir de l\'utilisateur');
  const contexte = String(corps.contexte || '').slice(0, 150_000);
  const dernier = msgs[msgs.length - 1];
  dernier.content = `<plan_en_cours>\n${contexte || 'Aucun plan dessiné pour l\'instant.'}\n</plan_en_cours>\n\n${poste.nom} (${poste.role}) : ${dernier.content}`;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  const tools = corps.agent === 'architecte' ? [OUTIL_PLAN] : undefined;
  const messages = [...msgs];
  let proposition = null;
  let echecsJson = 0;

  for (let tour = 0; tour < 4; tour++) {
    let reponse;
    try {
      const flux = client.beta.messages.stream({
        model: MODELE,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: agent.effort },
        system: [{ type: 'text', text: agent.instructions, cache_control: { type: 'ephemeral' } }],
        ...(tools ? { tools } : {}),
        messages,
      });
      reponse = await flux.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new ErreurStudio('Agents très sollicités, réessayez dans un instant.', 429);
      if (e instanceof Anthropic.APIError) { console.error('API', e.status, e.message); throw new ErreurStudio('Agent momentanément indisponible.', 502); }
      // JSON d'outil illisible pendant le flux : on relance une fois
      if (++echecsJson <= 1) continue;
      throw new ErreurStudio("L'agent a produit une réponse illisible, reformulez la demande.", 502);
    }

    if (reponse.stop_reason === 'refusal') return { reponse: "L'agent ne peut pas traiter cette demande.", proposition, agent: agent.nom };
    const texte = reponse.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const appels = reponse.content.filter((b) => b.type === 'tool_use');

    if (reponse.stop_reason === 'max_tokens' && appels.length) {
      return { reponse: `${texte}\n\n(La proposition était trop longue et a été interrompue : demandez un plan plus simple ou niveau par niveau.)`, proposition, agent: agent.nom };
    }
    if (reponse.stop_reason !== 'tool_use' || !appels.length) {
      return { reponse: texte || 'Pas de réponse.', proposition, agent: agent.nom };
    }

    messages.push({ role: 'assistant', content: reponse.content });
    const resultats = appels.map((b) => {
      if (b.name !== 'proposer_plan') return { type: 'tool_result', tool_use_id: b.id, content: 'Outil inconnu', is_error: true };
      const erreurs = validerPlan(b.input);
      if (erreurs.length) {
        return { type: 'tool_result', tool_use_id: b.id, is_error: true, content: JSON.stringify({ INVALID_INPUT: erreurs }) };
      }
      proposition = b.input;
      return { type: 'tool_result', tool_use_id: b.id, content: "Proposition transmise à l'atelier. Résume maintenant tes choix et les points à vérifier, sans répéter les coordonnées." };
    });
    messages.push({ role: 'user', content: resultats });
  }
  return { reponse: 'Analyse interrompue (trop d\'étapes).', proposition, agent: agent.nom };
}
