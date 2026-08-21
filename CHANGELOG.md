# Journal des modifications

Toutes les livraisons notables du backend sont documentées ici, une entree
par version tagguee (`vX.Y.Z`). Sert de checklist au moment du deploiement
chez un client : voir `deploy/README.md` pour la procedure generale, et
`deploy/<client>/<version>/` pour les scripts SQL propres a chaque livraison.

## [1.1.0] - 2026-08-20

### Ajoute
- Types de contrat "Apprenti" et "Alternant" (`CreateEmployeeDto`).

### Corrige
- Un ajustement manuel de solde ("Ajuster un solde" cote RH) bloquait
  silencieusement le prochain credit automatique du meme type de conge.
  Nouvelle colonne `LeaveTransaction.Source` (`System`/`Manual`) pour
  distinguer les deux et ne dedupliquer que sur les credits automatiques.
- Double credit possible sur un type de conge a accumulation mensuelle
  (la deduplication existait pour les types annuels, pas pour les mensuels).

### Deploiement
- Script requis : `deploy/galana/v1.1.0/03-update.sql`
  (`ALTER TABLE LeaveTransaction ADD Source ...`, additif, sans risque de
  perte de donnees).
- **Ordre obligatoire** : appliquer le script SQL chez le client AVANT de
  deployer ce backend. Le code de cette version suppose que la colonne
  `Source` existe deja.
- Checklist post-deploiement :
  - [ ] Script SQL confirme applique par le DBA client
  - [ ] Version affichee dans l'app = v1.1.0, identique cote frontend et backend
  - [ ] Connexion admin fonctionne

## [1.0.0] - 2026-08-16

Livraison initiale chez Galana.

### Conges & absences
- Creation, workflow de validation multi-niveaux, visibilite
  createur/beneficiaire, calendrier par categorie d'employes.
- Regles metier interimaire et regularisation, garde-fous post-approbation,
  suppression definitive encadree.
- Validation par email sans connexion (approuver/refuser/retourner via lien).
- Demandes deja traitees restent visibles cote manager dans "a valider".

### Missions & notes de frais
- Creation/validation, lignes de frais complementaires, mission accompagnant.
- Plafond de note de frais par categorie, delai de justificatif, garde-fous
  de suppression sur les elements deja approuves.

### Notifications & emails
- Notifications temps reel (WebSocket), refonte des emails, messages
  d'erreur traduits en francais.

### Employes & configuration
- Import CSV en masse, pieces jointes (SharePoint), reset de mot de passe,
  option de desactivation du changement de mot de passe oblige.

### Securite
- Fermeture de trois failles de controle d'acces et de coherence avant
  livraison client.

### Outillage de deploiement
- Build standalone (`ncc`, sans `node_modules` ni CLI Prisma requis chez
  le client), scripts SQL pour clients auto-heberges, `db:init`/`db:reset`
  securises.

### Deploiement
- Scripts : `deploy/galana/v1.0.0/01-schema.sql` puis `02-seed.sql`, dans
  cet ordre, sur une base SQL Server vide.
