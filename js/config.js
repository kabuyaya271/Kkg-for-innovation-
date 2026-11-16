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
  email: 'kkgforbusiness@gmail.com',
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
      description: 'Plans cotés de chaque niveau et plan de masse (PDF), tableau des surfaces. Licence pour 1 construction.',
    },
    complet: {
      nom: 'Pack complet',
      multiplicateur: 1.6,
      description: 'Essentiel + fichiers DXF modifiables (AutoCAD) + maquette 3D complète. Licence pour 1 construction.',
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
    { operateur: 'Airtel Money', numero: '+243 975 465 965', titulaire: 'Grâce Kabuyaya' },
  ],

  // Paiement depuis l'étranger, sans banque : le client envoie l'argent sur votre
  // Mobile Money via un service de transfert international (carte bancaire acceptée
  // par ces services). Fonctionne sans RCCM ni compte bancaire.
  transfertInternational: {
    actif: true,
    numero: '+243 975 465 965',
    operateur: 'Airtel Money',
    beneficiaire: 'Grâce Kabuyaya',   // nom exact du titulaire du compte Airtel Money
    services: [
      { nom: 'Taptap Send', url: 'https://www.taptapsend.com' },
      { nom: 'WorldRemit', url: 'https://www.worldremit.com' },
      { nom: 'Western Union', url: 'https://www.westernunion.com' },
      { nom: 'MoneyGram', url: 'https://www.moneygram.com' },
    ],
  },

  // Virement bancaire — laissez iban vide pour désactiver
  banque: { banque: '', titulaire: '', iban: '', swift: '' },

  // ---------------- Services en ligne ----------------
  // Adresse de l'agent IA + boîte aux requêtes (dossier agent-ia/, Cloudflare Worker)
  // ex. 'https://kkg-agent.votre-compte.workers.dev'
  agentIA: '',

  // Formspree (https://formspree.io) : copie des commandes / requêtes par e-mail (facultatif)
  formspree: '',

  // Empreinte SHA-256 du mot de passe de l'espace concepteur (le mot de passe
  // lui-même n'apparaît nulle part). Pour le changer : admin.html → onglet
  // « Publier en ligne » → « Changer le mot de passe », puis collez la ligne obtenue ici.
  adminEmpreinteMotDePasse: '1894023ae719101eb83f558b2fefddfd9eb80620a6f47da6186e2c25277531e0',

  // Date d'entrée en vigueur des conditions juridiques
  dateConditions: '15 novembre 2026',
};
