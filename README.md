# QCM — Formation assurance vie

Application React / TypeScript / Vite, API Node.js pour Vercel et PostgreSQL Neon. La présentation et le dashboard reprennent le projet local **Qcm_microassurance**, avec un questionnaire et un barème propres à l’assurance vie.

## Démarrage local

Node.js 22.12+ et Python 3.10+ (Python sert uniquement à réimporter/vérifier le classeur).

```powershell
npm install
npm run setup:local
npm run dev
```

Le script `setup:local` crée un `.env` local et initialise une base PostgreSQL embarquée PGlite dans `.local-data/postgres`. Il refuse d’écraser un `.env` existant. Sur le poste où le projet a été créé, cette initialisation a déjà été effectuée : exécuter directement `npm run dev`.

- Candidats : `http://localhost:5173/`
- Administration : `http://localhost:5173/admin`, uniquement par accès direct à l’URL. Aucun lien administrateur n’est affiché dans l’espace candidat.
- Identifiants administrateur : `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans le fichier local `.env`. Le mot de passe est généré aléatoirement, sans compte public prédéfini.

Vite sert aussi l’API en développement. Les mêmes handlers et requêtes SQL sont utilisés avec Neon en production. Le mode local est refusé sur Vercel. Ne pas lancer deux processus simultanément sur la même base PGlite.

## Contenu importé

Le classeur original est conservé dans `source/QCM_formation_assurance_vie.xlsx`. Il n’est pas inclus dans le site public.

- 20 questions, 4 modules, 5 questions par module.
- Libellés, options A–D, bonnes réponses, justifications et références reproduits sans reformulation.
- Une seule réponse correcte ; 1 point par bonne réponse, 0 sinon.
- Durée : 30 minutes, conformément à la demande.
- Barème du document : **Acquis ≥ 70 %** (14/20), **À consolider ≥ 50 %** (10/20), sinon **Non acquis**.
- Les modules 1 et 6 sont exclus, comme dans le classeur.

Les mentions destinées au formateur dans le document sont du contenu source. Le corrigé est présenté au candidat après soumission, conformément à la fonctionnalité demandée. Aucune vérification juridique ni modification des corrections n’est effectuée.

```powershell
npm run import:questions
npm run verify:import
npm run db:seed
```

Pour importer un autre fichier de même structure : `python scripts/import_questionnaire.py "C:\chemin\questionnaire.xlsx"`. Les trois premières feuilles doivent suivre la structure fournie. Le script vérifie la cohérence entre questions et corrections et refuse un changement non reconnu des règles de notation. Le nombre de questions, le maximum, les seuils en points, la navigation et les résultats sont calculés depuis les données. Chaque modification crée une version du questionnaire : les anciennes tentatives gardent leurs questions et leur corrigé. Le seed est idempotent.

## Mise en production Vercel + Neon

1. Créer une **base Neon dédiée et vide** pour cette application. Ne pas utiliser les tables des anciens QCM : les noms de tables sont similaires.
2. Copier `.env.example` dans un environnement de configuration sécurisé et renseigner :
   - `DATABASE_MODE=neon`
   - `DATABASE_URL` : chaîne PostgreSQL Neon avec SSL.
   - `JWT_SECRET` : secret aléatoire d’au moins 32 caractères.
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` : compte à créer, mot de passe d’au moins 12 caractères.
3. Avec ces variables dans l’environnement du terminal, exécuter `npm run db:migrate` puis `npm run db:seed`. Les variables d’environnement du terminal ont priorité sur `.env`.
4. Importer le dépôt dans Vercel : preset Vite, build `npm run build`, sortie `dist`.
5. Configurer **uniquement côté serveur** `DATABASE_MODE=neon`, `DATABASE_URL` et `JWT_SECRET` dans Vercel. Ne pas préfixer ces secrets par `VITE_`. Les identifiants d’amorçage administrateur ne sont pas requis à l’exécution.
6. Déployer puis vérifier une tentative complète et la connexion à `/admin`.

`vercel.json` dirige `/api/*` vers une fonction unique `api/index.ts` et les pages vers React. Les corrections restent dans la base et ne sont jamais importées dans le bundle navigateur. L’accès administrateur utilise un cookie HTTP-only, SameSite Strict, Secure en production, valable 8 heures, et une limitation des tentatives de connexion persistée en base.

Documentation de référence : [fonctions Node.js Vercel](https://vercel.com/docs/functions/runtimes/node-js), [pilote serverless Neon](https://neon.com/docs/serverless/serverless-driver).

## Comportement et sauvegarde

- Le formulaire demande nom/prénom et agence/entité, comme le projet de référence.
- Questions une par une : cocher une réponse enregistre le choix et affiche automatiquement la question suivante après 250 ms, même hors ligne. Navigation libre et retour arrière restent disponibles. La dernière question conserve la confirmation finale avant soumission.
- La date limite est créée et contrôlée par le serveur. Recharger ou fermer la page ne redémarre pas les 30 minutes.
- Chaque sélection est immédiatement conservée dans le navigateur, puis synchronisée avec PostgreSQL. Les erreurs réseau restent visibles ; une nouvelle tentative de synchronisation intervient au retour du réseau et toutes les 5 secondes.
- Une soumission manuelle attend la sauvegarde. À expiration, seules les réponses reçues avant la limite sont notées. Les réponses locales non synchronisées sont signalées dans le résultat.
- La clôture est transactionnelle et idempotente. Les réponses ne peuvent plus être modifiées après clôture ni après la limite serveur.
- Une tentative abandonnée est finalisée à la reprise ou lors de la consultation des données administrateur. Aucun cron n’est requis.
- La reprise exige le même navigateur et son stockage local. Effacer ce stockage supprime le jeton candidat ; le résultat reste disponible au formateur.
- Les PDF contiennent de véritables fichiers téléchargeables : correction complète, synthèse administrateur et classement. Le CSV exporte toutes les tentatives. Les moyennes et graphiques administrateur sont normalisés sur 20 et le classement utilise le pourcentage, pour comparer différentes versions.

## Vérification

```powershell
npm run verify:import
npm test
npm run build
npm run test:e2e
```

Les tests API utilisent PostgreSQL PGlite en mémoire : notation, fidélité du corrigé, protection des accès, expiration, reprise, soumission répétée, statistiques, classement et CSV. Les tests navigateur utilisent Chrome installé et une base temporaire isolée, sans modifier les données locales. Ils vérifient notamment le parcours complet, le mode hors ligne, les PDF et l’affichage mobile.

Les connexions à Neon et le déploiement Vercel doivent être vérifiés après fourniture de la configuration de production ; aucun identifiant de vos anciens projets n’a été réutilisé.

Validation réalisée : import comparé au classeur, 14 tests unitaires/API, 2 tests Chrome et build de production réussis. L’audit des dépendances de production ne signale aucune vulnérabilité ; l’audit complet signale encore 15 alertes dans les outils de développement hérités (notamment Tailwind, Vitest et les types/outils Vercel). Leur mise à niveau majeure reste à traiter séparément.
