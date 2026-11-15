# Agent IA et boîte aux requêtes — KKG for Innovation

Ce petit serveur (un *Cloudflare Worker*, gratuit jusqu'à 100 000 appels par jour) fait trois choses pour le site :

1. **Assistant IA** (`POST /chat`) : il répond aux visiteurs 24 h/24. Il connaît le catalogue (lu automatiquement sur le site) et vos règles commerciales (licences, acompte de 50 %, révisions). Il aide à formuler une demande et l'enregistre dans la boîte aux requêtes. Il fonctionne avec Claude (modèle `claude-opus-5-5`) via le SDK officiel d'Anthropic.
2. **Boîte aux requêtes** (`POST /requetes`) : elle centralise les demandes sur mesure, les adaptations, les questions, les réclamations et les commandes. Elles viennent des formulaires du site et de l'assistant.
3. **Journal des opérations** (`GET/POST /journal`, protégé par jeton) : journal horodaté et chaîné par empreintes SHA-256 de chaque commande, requête, changement de statut et paiement. Il est consultable et exportable dans l'onglet **Historique** de `admin.html`.
4. **Consultation** (`GET /requetes`, protégé par un jeton) : c'est l'onglet **Requêtes** de `admin.html`. Vous y voyez chaque demande, répondez sur WhatsApp en un clic et suivez le statut (nouvelle → devis envoyé → acompte reçu → terminée).

Sans ce serveur, le site fonctionne quand même : les demandes partent alors par WhatsApp.

5. **Atelier de conception** (`/studio/*`) : postes de l'équipe avec codes d'accès, études partagées et versionnées, et **5 agents IA spécialisés** (architecte, ingénieur structure, métreur, conformité, rédacteur). L'architecte peut proposer des plans complets que l'on applique dans l'atelier.

## Ce qu'il vous faut

| Compte | Coût | Pourquoi |
|---|---|---|
| [Cloudflare](https://dash.cloudflare.com/sign-up) | gratuit | héberge le serveur et stocke les requêtes |
| [Console Anthropic](https://console.anthropic.com) | à l'usage (crédit prépayé) | fait fonctionner l'assistant IA |
| Node.js 20+ sur votre ordinateur | gratuit | pour lancer la mise en ligne (une seule fois) |

**Coût de l'IA (ordre de grandeur) :** environ 1 à 3 centimes de dollar par message de visiteur. Les instructions et le catalogue sont mis en cache, ce qui réduit fortement le prix des messages suivants.
- **Fixez une limite de dépenses mensuelle** dans la Console Anthropic (*Settings → Limits*). Vous ne pourrez jamais dépasser votre budget.
- **Atelier :** les agents de conception réfléchissent davantage. Comptez environ 5 à 30 centimes par demande, selon la taille du plan. Une proposition de plan complète peut prendre une à deux minutes.
- **Offre Cloudflare :** l'offre gratuite limite chaque appel à 10 ms de calcul. Cela suffit pour l'assistant du site, mais pas toujours pour les grands plans de l'atelier. Pour l'atelier, prenez l'offre **Workers Paid (5 $/mois)**.
- Pour réduire le coût, remplacez `claude-opus-5-5` par `claude-sonnet-5-5` ou `claude-haiku-5-5` dans `src/index.js` (constante `MODELE`). Les réponses seront un peu moins fines.

## Mise en ligne (≈ 15 minutes)

```bash
cd agent-ia
npm install
npx wrangler login                          # ouvre le navigateur pour vous connecter à Cloudflare

npx wrangler kv namespace create REQUETES   # crée le stockage des requêtes
# → copiez l'"id" affiché dans wrangler.toml (ligne id = "...")

npx wrangler secret put ANTHROPIC_API_KEY   # collez votre clé API Anthropic (sk-ant-...)
npx wrangler secret put ADMIN_TOKEN         # inventez un mot de passe long (≥ 20 caractères)
npx wrangler secret put FORMSPREE_URL       # facultatif : recevoir aussi chaque requête par e-mail

npx wrangler deploy
# → affiche l'adresse du serveur, ex. https://kkg-agent.votre-compte.workers.dev
```

Ensuite :

1. Dans `wrangler.toml`, vérifiez `SITE_URL` (adresse de votre site) et `ALLOWED_ORIGINS` (domaine du site), puis relancez `npx wrangler deploy` si vous les avez modifiés.
2. Dans le site, ouvrez `js/config.js` et collez l'adresse du serveur dans `agentIA: '...'`.
3. Publiez le site. La bulle « Une question ? » devient un vrai assistant. Dans `admin.html`, l'onglet **Requêtes** demande le jeton `ADMIN_TOKEN`.

## Personnaliser l'assistant

- `src/connaissances.js` contient les informations sur l'entreprise : contacts, licences, acompte, moyens de paiement. **Gardez-les identiques à `js/config.js`** et redéployez après chaque changement.
- `src/index.js`, fonction `instructions()`, contient le comportement de l'assistant. Il est volontairement prudent :
  - il ne fixe aucun prix sur mesure, n'accorde aucune remise et ne prend aucun engagement ;
  - il renvoie vers un ingénieur ou un architecte local pour la structure et le permis ;
  - il met en garde contre les faux numéros de paiement.

## Sécurité

- La clé API et le jeton administrateur sont des **secrets Cloudflare**. Ils ne sont jamais dans le code ni sur le site.
- Seuls les domaines de `ALLOWED_ORIGINS` (et `localhost` pour vos tests) peuvent appeler l'assistant depuis un navigateur.
- Une limite simple de 20 messages par minute et par adresse IP est intégrée. Pour une protection plus forte, ajoutez une règle *Rate limiting* dans le tableau de bord Cloudflare.
- Les conversations ne sont conservées que lorsqu'une requête est enregistrée (jointes à la requête, pour le suivi).

## Tester en local

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars
echo 'ADMIN_TOKEN=test' >> .dev.vars
npx wrangler dev        # serveur sur http://localhost:8787
```
