# École Manager

Application de gestion scolaire complète : élèves, enseignants, classes, notes, présences, annonces — avec un système de rôles strict où **seuls le Fondateur et le Directeur Général peuvent créer des comptes**.

Stack : **React + Vite + TailwindCSS + Supabase** (Auth + Postgres + RLS + Edge Functions).

---

## 🚀 Démarrage rapide

### 1. Prérequis

- Node.js 18+ et npm
- Un compte gratuit sur [supabase.com](https://supabase.com)

### 2. Cloner / récupérer le projet

```bash
cd ~
# le projet est déjà dans ecole-management/
cd ecole-management
npm install
```

### 3. Créer le projet Supabase

1. Va sur [supabase.com/dashboard](https://supabase.com/dashboard) et crée un **nouveau projet**
2. Note le **Project URL** et **anon/public key** (Project Settings → API)

### 4. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Ouvre `.env` et remplis :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 5. Initialiser la base de données

Dans le dashboard Supabase → **SQL Editor** → **New query** → colle et exécute :

```
supabase/migrations/001_init.sql
```

Cela crée toutes les tables, les politiques RLS et les données de référence (matières, année scolaire).

### 6. Créer le premier compte Fondateur

C'est l'étape critique — sans Fondateur, personne ne peut créer d'autres comptes.

1. **Dashboard Supabase → Authentication → Users → "Add user"**
   - Email : `fondateur@monecole.com` (ton choix)
   - Password : un mot de passe fort
   - ✅ **Coche "Auto Confirm User"**
2. Copie l'UUID de l'utilisateur créé (colonne ID)
3. Ouvre `supabase/migrations/002_bootstrap_admin.sql`, remplace `v_user_id`, `v_email`, `v_first`, `v_last` par tes valeurs
4. Colle et exécute le SQL dans le **SQL Editor**

### 7. Déployer l'Edge Function (création de comptes)

L'application appelle une fonction sécurisée pour créer les comptes. Tu as deux options :

**Option A — Via Supabase CLI** (recommandée)
```bash
npm install -g supabase
supabase login
supabase link --project-ref TON_PROJECT_REF
supabase functions deploy admin-create-user --no-verify-jwt
```

**Option B — Via le dashboard**
1. Dashboard Supabase → **Edge Functions** → **Create a new function**
2. Nom : `admin-create-user`
3. Copie/colle le contenu de `supabase/functions/admin-create-user/index.ts`
4. Deploy

> ℹ️ Les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont **automatiquement injectés** par Supabase.

### 8. Lancer l'application

```bash
npm run dev
```

Ouvre http://localhost:5173 et connecte-toi avec le compte Fondateur que tu viens de créer.

---

## 🔐 Système de rôles

| Rôle | Peut faire | Ne peut pas |
|------|-----------|-------------|
| **Fondateur** | Tout | – |
| **Directeur Général** | Tout (sauf comptabilité détaillée) | – |
| **Directeur des Études** | Classes, matières, élèves, profs, notes | Créer des comptes |
| **Coordinateur** | Voir/gérer pédagogie | Créer des comptes |
| **Surveillant Général** | Présences, justifications, sanctions | Notes, créer comptes |
| **Comptable** | Comptabilité (à venir) | Reste |
| **Professeur** | Notes & appel de ses classes | Tout autre |
| **Élève** | Consulter ses notes, présences, annonces | Modifier quoi que ce soit |

⚠️ **Seul le Fondateur ou le DG peut créer un compte.** Les autres utilisateurs reçoivent leurs identifiants (email + mot de passe temporaire) et doivent les changer à la première connexion.

La sécurité est appliquée à **deux niveaux** :
- côté UI (routes protégées, boutons cachés)
- côté base de données via **Row Level Security (RLS)** — impossible de contourner même en bricolant l'API

---

## 📦 Modules livrés (V1)

- ✅ Authentification + 8 rôles + RLS complète
- ✅ Création de comptes restreinte au Fondateur/DG (Edge Function)
- ✅ Tableau de bord adapté au rôle
- ✅ Classes (CRUD, niveaux primaire/collège/lycée)
- ✅ Matières
- ✅ Élèves (CRUD, filtre par classe, infos parent)
- ✅ Enseignants (CRUD, affectations matière × classe)
- ✅ Notes (saisie prof, consultation élève, filtres trimestre/matière/classe)
- ✅ Présences (appel par classe/date, justification d'absences)
- ✅ Annonces (avec audience ciblée par rôle, épinglage)
- ✅ Profil utilisateur + changement de mot de passe forcé au premier accès
- ✅ Journal d'activité (audit des créations de comptes)

## 🛠 Modules à venir (V2)

- ⏳ Comptabilité (Fondateur uniquement)
- ⏳ Bulletins PDF imprimables
- ⏳ Emplois du temps visuels
- ⏳ Gouvernement des élèves (propositions d'événements, signalements matériels)
- ⏳ Rapports & statistiques avancés
- ⏳ Notifications push / email aux parents

---

## 📁 Structure du projet

```
ecole-management/
├── src/
│   ├── components/        Layout, Sidebar, Topbar, composants UI
│   ├── contexts/          AuthContext, ToastContext
│   ├── lib/               supabase client, roles helpers
│   └── pages/             1 fichier par écran
├── supabase/
│   ├── migrations/        SQL d'initialisation
│   └── functions/         Edge Function admin-create-user
├── .env.example
└── package.json
```

## 📜 Scripts npm

| Commande | Action |
|---------|--------|
| `npm run dev` | Lance le serveur de développement |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build de production en local |

---

## 🐛 Dépannage

**"VITE_SUPABASE_URL manquant"** → ton fichier `.env` n'existe pas ou est mal nommé. Vérifie qu'il est à la racine du projet.

**"Profil introuvable" après connexion** → l'utilisateur existe dans `auth.users` mais pas dans `profiles`. Exécute le bootstrap (étape 6) ou crée le profil manuellement.

**"Réservé au Fondateur ou au Directeur Général" en créant un compte** → ton compte n'a pas le rôle requis. Vérifie `profiles.role` en base.

**L'Edge Function renvoie 401/403** → vérifie que tu es bien connecté avec un compte Fondateur/DG ; vérifie que la fonction a été déployée avec `--no-verify-jwt`.

**Erreur RLS "permission denied"** → c'est voulu si tu n'as pas le bon rôle. Sinon vérifie que les politiques de `001_init.sql` ont bien été appliquées.

---

Construit avec ❤️ pour l'éducation en Afrique.
