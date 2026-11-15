// =====================================================================
//  CONFIGURATION DU SITE — modifiez ce fichier pour personnaliser
//  Un champ laissé vide ('') est simplement masqué sur le site.
// =====================================================================
export const CONFIG = {
  nomSite: 'KKG for Innovation',
  slogan: 'Plans de construction en 3D, prêts à bâtir ou conçus sur mesure',

  // ---------------- Identité de l'entreprise (mentions légales) ----------------
  entreprise: {
    raisonSociale: 'KKG for Innovation',
    formeJuridique: '',        // ex. 'Établissement', 'SARLU', 'SARL'…
    rccm: '',                  // n° RCCM (Registre du commerce)
    idNat: '',                 // n° d'identification nationale
    nif: '',                   // n° impôt (NIF)
    siege: 'Kinshasa, République Démocratique du Congo',
    responsable: '',           // nom du responsable / gérant
  },

  // Coordonnées officielles (les SEULES à utiliser pour payer — voir CGV)
  email: '',                         // à compléter avec l'adresse Gmail professionnelle
  telephone: '+243 975 465 965',
  whatsapp: '243975465965',          // format international sans + ni espaces

  // Devise et format des prix
  devise: 'USD',
  locale: 'fr-FR',

  // ---------------- Licences (vente des plans du catalogue) ----------------
  licences: {
    essentiel: {
      nom: 'Essentiel',
      multiplicateur: 1,
      description: 'Plans PDF : niveaux, façades, coupes, toiture. Licence pour 1 construction.',
    },
    complet: {
      nom: 'Pack complet',
      multiplicateur: 1.6,
      description: 'PDF + fichiers DWG modifiables + maquette 3D + métré estimatif. Licence pour 1 construction.',
    },
    exclusif: {
      nom: 'Exclusivité',
      multiplicateur: 4,
      description: 'Pack complet + exclusivité : le plan est retiré de la vente. Constructions illimitées pour vous.',
    },
  },

  // ---------------- Projets sur mesure & adaptations ----------------
  surMesure: {
    acomptePourcent: 50,        // avance versée à l'acceptation du devis
    revisionsIncluses: 2,       // séries de modifications comprises dans le prix
    validiteDevisJours: 30,
    delaiReclamationJours: 7,   // délai pour signaler un défaut des fichiers livrés
  },

  // ---------------- Paiements ----------------
  // Lien de paiement par carte (Stripe, CinetPay, Flutterwave, PayPal…). Vide = désactivé.
  lienPaiementCarte: '',

  mobileMoney: [
    // Vérifiez l'opérateur et indiquez le nom exact du titulaire du compte.
    { operateur: 'Airtel Money', numero: '+243 975 465 965', titulaire: '' },
  ],

  // Virement bancaire — laissez iban vide pour désactiver
  banque: { banque: '', titulaire: '', iban: '', swift: '' },

  // ---------------- Services en ligne ----------------
  // Adresse de l'agent IA + boîte aux requêtes (dossier agent-ia/, Cloudflare Worker)
  // ex. 'https://kkg-agent.votre-compte.workers.dev'
  agentIA: '',

  // Formspree (https://formspree.io) : copie des commandes / requêtes par e-mail (facultatif)
  formspree: '',

  // Mot de passe de l'espace concepteur (protection simple côté navigateur)
  adminMotDePasse: 'kkg2026',

  // Date d'entrée en vigueur des conditions juridiques
  dateConditions: '15 novembre 2026',
};
