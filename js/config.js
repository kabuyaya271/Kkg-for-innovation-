// =====================================================================
//  CONFIGURATION DU SITE — modifiez ce fichier pour personnaliser
// =====================================================================
export const CONFIG = {
  nomSite: 'KKG Innovation',
  slogan: 'Plans de construction en 3D, prêts à bâtir',
  concepteur: 'KKG for Innovation — Bureau de conception',
  email: 'contact@exemple.com',          // e-mail affiché aux clients
  telephone: '+243 000 000 000',
  adresse: 'Kinshasa, RD Congo',

  // Devise et format des prix
  devise: 'USD',
  locale: 'fr-FR',

  // Licences proposées à la vente (multiplicateur appliqué au prix de base)
  licences: {
    essentiel: {
      nom: 'Essentiel',
      multiplicateur: 1,
      description: 'Plans PDF : niveaux, façades, coupes, toiture. Usage pour 1 construction.',
    },
    complet: {
      nom: 'Pack complet',
      multiplicateur: 1.6,
      description: 'PDF + fichiers DWG modifiables + maquette 3D + métré estimatif. 1 construction.',
    },
    exclusif: {
      nom: 'Exclusivité',
      multiplicateur: 4,
      description: 'Pack complet + droits exclusifs : le plan est retiré de la vente. Constructions illimitées.',
    },
  },

  // ---------------------------------------------------------------
  //  PAIEMENTS — laissez vide ('' ou []) pour désactiver une méthode
  // ---------------------------------------------------------------
  // Lien de paiement Stripe général (https://buy.stripe.com/...).
  // Chaque projet peut aussi avoir son propre "lienPaiement".
  stripeLienGeneral: '',

  // Numéro WhatsApp (format international sans + ni espaces)
  whatsapp: '243000000000',

  // Comptes Mobile Money
  mobileMoney: [
    { operateur: 'M-Pesa', numero: '+243 81 000 0000', titulaire: 'KKG Innovation' },
    { operateur: 'Orange Money', numero: '+243 89 000 0000', titulaire: 'KKG Innovation' },
    { operateur: 'Airtel Money', numero: '+243 99 000 0000', titulaire: 'KKG Innovation' },
  ],

  // Virement bancaire
  banque: {
    banque: 'Nom de la banque',
    titulaire: 'KKG Innovation',
    iban: 'XX00 0000 0000 0000 0000 0000',
    swift: 'XXXXXXXX',
  },

  // Formspree (https://formspree.io) : reçoit chaque commande par e-mail.
  // Exemple : 'https://formspree.io/f/abcdwxyz'
  formspree: '',

  // Mot de passe de l'espace concepteur (protection simple côté navigateur,
  // ce n'est PAS une sécurité forte : ne publiez rien de confidentiel).
  adminMotDePasse: 'kkg2026',
};
