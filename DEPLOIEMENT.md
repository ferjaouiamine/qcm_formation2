# Publier le QCM : GitHub → Neon → Vercel

Le dépôt Git local est indépendant des autres projets, sur la branche `main`.

## 1. Envoyer le code sur GitHub

Créer un dépôt GitHub **privé et vide**, par exemple `qcm-assurance-vie`, sans README, licence ni `.gitignore` supplémentaires. Le projet contient le questionnaire et son corrigé.

Dans PowerShell, depuis le dossier du projet, remplacer l’adresse ci-dessous par celle du dépôt créé :

```powershell
Set-Location 'C:\Users\LENOVO I5\Desktop\qcm_formation2'
git remote add origin https://github.com/VOTRE_COMPTE/qcm-assurance-vie.git
git push -u origin main
```

Le premier commit est préparé localement. Si Git demande une authentification, se connecter à GitHub via le gestionnaire d’identifiants proposé. Ne pas placer de jeton dans l’URL du dépôt.

Pour les mises à jour suivantes :

```powershell
git add .
git commit -m "Mise à jour du QCM"
git push
```

Le `.gitignore` exclut `.env`, `node_modules`, `dist` et la base locale. Ne pas forcer leur ajout.

Référence : [publier un dépôt local sur GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## 2. Préparer Neon

Créer un projet Neon dédié à ce QCM. Utiliser une base vide, distincte de celles des autres formations.

Depuis la fenêtre **Connect**, sélectionner la base et copier la chaîne de connexion PostgreSQL. Conserver tous ses paramètres, notamment SSL. La chaîne contient le mot de passe de la base : la conserver uniquement dans les variables d’environnement.

Dans le fichier `.env` local existant, modifier uniquement :

```dotenv
DATABASE_MODE=neon
DATABASE_URL="COLLER_ICI_LA_CHAINE_POSTGRESQL_NEON"
```

Conserver `JWT_SECRET` déjà généré. Renseigner `ADMIN_EMAIL` et `ADMIN_PASSWORD` pour le compte formateur souhaité ; le mot de passe doit contenir au moins 12 caractères. Ne pas utiliser les identifiants de connexion à Neon comme identifiants du formateur.

Puis exécuter, dans cet ordre et en arrêtant si une commande échoue :

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Vérifier `http://localhost:5173/` puis `http://localhost:5173/admin`. Les questions et les tentatives sont désormais enregistrées dans Neon. Pour repasser à la base locale, remettre `DATABASE_MODE=local` et redémarrer le serveur.

Référence : [connexion à Neon](https://neon.com/docs/get-started-with-neon/connect-neon).

## 3. Déployer sur Vercel

Importer le dépôt GitHub dans Vercel. La configuration du projet est déjà présente dans `vercel.json` :

| Réglage | Valeur |
| --- | --- |
| Framework | Vite |
| Build | `npm run build` |
| Dossier de sortie | `dist` |

Dans les variables d’environnement du projet Vercel, ajouter :

| Variable | Valeur |
| --- | --- |
| `DATABASE_MODE` | `neon` |
| `DATABASE_URL` | La même chaîne Neon que dans `.env` |
| `JWT_SECRET` | La même valeur que dans `.env` |

`ADMIN_EMAIL` et `ADMIN_PASSWORD` servent à créer le compte pendant `db:seed` ; ils ne sont pas nécessaires au fonctionnement du site déployé. Aucun secret ne doit porter le préfixe `VITE_`.

Déployer après avoir initialisé Neon. Si les variables changent après un premier déploiement, effectuer un nouveau déploiement pour les appliquer.

Après publication :

- Candidat : `https://VOTRE-SITE.vercel.app/`
- Formateur : `https://VOTRE-SITE.vercel.app/admin`

Référence : [variables d’environnement Vercel](https://vercel.com/docs/environment-variables).
