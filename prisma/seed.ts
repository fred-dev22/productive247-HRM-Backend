import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from './generated/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaMssql(process.env.DATABASE_URL as string),
});

const ADMIN_EMAIL = 'admin@galana.com';
const ADMIN_PASSWORD = 'Admin@2026!';

// Catalogue fixe des permissions — jamais modifiable depuis l'UI, seule
// l'association Categorie <-> Permission l'est (ecran Configuration > Catégories).
const PERMISSIONS: { Code: string; Label: string; Module: string }[] = [
  { Code: 'CONGE_VOIR_EQUIPE', Label: "Voir les demandes de congé de son équipe", Module: 'Congés' },
  { Code: 'CONGE_VOIR_TOUT', Label: 'Voir toutes les demandes de congé', Module: 'Congés' },
  { Code: 'CONGE_VALIDER', Label: 'Valider / rejeter une demande de congé', Module: 'Congés' },
  { Code: 'CONGE_SUPPRIMER', Label: 'Supprimer définitivement une demande de congé', Module: 'Congés' },

  { Code: 'MISSION_VOIR_EQUIPE', Label: "Voir les ordres de mission de son équipe", Module: 'Missions' },
  { Code: 'MISSION_VOIR_TOUT', Label: 'Voir tous les ordres de mission', Module: 'Missions' },
  { Code: 'MISSION_VALIDER', Label: 'Valider / rejeter un ordre de mission', Module: 'Missions' },
  { Code: 'MISSION_SUPPRIMER', Label: 'Supprimer définitivement un ordre de mission', Module: 'Missions' },

  { Code: 'FRAIS_VOIR_EQUIPE', Label: "Voir les notes de frais de son équipe", Module: 'Notes de frais' },
  { Code: 'FRAIS_VOIR_TOUT', Label: 'Voir toutes les notes de frais', Module: 'Notes de frais' },
  { Code: 'FRAIS_VALIDER', Label: 'Valider / rejeter une note de frais', Module: 'Notes de frais' },
  { Code: 'FRAIS_SUPPRIMER', Label: 'Supprimer définitivement une note de frais', Module: 'Notes de frais' },

  { Code: 'EMPLOYE_VOIR_EQUIPE', Label: 'Voir la fiche des employés de son équipe', Module: 'Employés' },
  { Code: 'EMPLOYE_VOIR_TOUT', Label: 'Voir la fiche de tous les employés', Module: 'Employés' },
  { Code: 'EMPLOYE_CREER', Label: 'Créer un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_MODIFIER', Label: 'Modifier un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_DESACTIVER', Label: 'Désactiver un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_SUPPRIMER', Label: 'Supprimer définitivement un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_COMPTE_CREER', Label: "Créer un compte d'accès système pour un employé", Module: 'Employés' },
  { Code: 'EMPLOYE_PERMISSION_GERER', Label: 'Gérer les permissions individuelles des employés', Module: 'Employés' },

  { Code: 'ENTITE_VOIR', Label: "Voir la structure organisationnelle", Module: 'Entités' },
  { Code: 'ENTITE_CREER', Label: 'Créer une entité', Module: 'Entités' },
  { Code: 'ENTITE_MODIFIER', Label: 'Modifier une entité', Module: 'Entités' },
  { Code: 'ENTITE_SOUMETTRE', Label: 'Soumettre une entité pour approbation', Module: 'Entités' },
  { Code: 'ENTITE_APPROUVER', Label: 'Approuver / rejeter une entité', Module: 'Entités' },
  { Code: 'ENTITE_DESACTIVER', Label: 'Désactiver une entité', Module: 'Entités' },
  { Code: 'ENTITE_SUPPRIMER', Label: 'Supprimer définitivement une entité', Module: 'Entités' },

  { Code: 'CATEGORIE_GERER', Label: 'Gérer les catégories et leurs permissions', Module: 'Administration' },

  { Code: 'CONFIG_CALENDRIER', Label: 'Configurer le calendrier', Module: 'Configuration' },
  { Code: 'CONFIG_JOURS_FERIES', Label: 'Configurer les jours fériés', Module: 'Configuration' },
  { Code: 'CONFIG_TYPES_CONGE', Label: 'Configurer les types de congé', Module: 'Configuration' },
  { Code: 'CONFIG_CATEGORIES_EMPLOYE', Label: 'Configurer les catégories employé', Module: 'Configuration' },
  { Code: 'CONFIG_FRAIS_MISSION', Label: 'Configurer les types et configs de frais / mission', Module: 'Configuration' },
  { Code: 'CONFIG_METIERS_POSTES', Label: 'Configurer les métiers et postes', Module: 'Configuration' },

  { Code: 'RAPPORT_VOIR', Label: 'Voir les rapports', Module: 'Rapports' },
  { Code: 'RAPPORT_EXPORTER', Label: 'Exporter les rapports', Module: 'Rapports' },
];

const VALIDATEUR_PERMISSIONS = [
  'CONGE_VOIR_EQUIPE', 'CONGE_VALIDER',
  'MISSION_VOIR_EQUIPE', 'MISSION_VALIDER',
  'FRAIS_VOIR_EQUIPE', 'FRAIS_VALIDER',
  'EMPLOYE_VOIR_EQUIPE',
];

const ADMIN_RH_PERMISSIONS = [
  ...VALIDATEUR_PERMISSIONS,
  'CONGE_VOIR_TOUT', 'MISSION_VOIR_TOUT', 'FRAIS_VOIR_TOUT',
  'EMPLOYE_VOIR_TOUT', 'EMPLOYE_CREER', 'EMPLOYE_MODIFIER', 'EMPLOYE_DESACTIVER', 'EMPLOYE_COMPTE_CREER',
  'ENTITE_VOIR', 'ENTITE_CREER', 'ENTITE_MODIFIER', 'ENTITE_SOUMETTRE',
  'CONFIG_CALENDRIER', 'CONFIG_JOURS_FERIES', 'CONFIG_TYPES_CONGE', 'CONFIG_CATEGORIES_EMPLOYE', 'CONFIG_FRAIS_MISSION', 'CONFIG_METIERS_POSTES',
  'RAPPORT_VOIR', 'RAPPORT_EXPORTER',
];

const DIRECTEUR_RH_PERMISSIONS = [
  ...ADMIN_RH_PERMISSIONS,
  'ENTITE_APPROUVER', 'ENTITE_DESACTIVER',
  'EMPLOYE_PERMISSION_GERER', 'CATEGORIE_GERER',
  // Suppression definitive (Lot I) — reservee au palier le plus eleve : plus
  // severe qu'une desactivation, non reversible depuis l'app.
  'CONGE_SUPPRIMER', 'MISSION_SUPPRIMER', 'FRAIS_SUPPRIMER', 'EMPLOYE_SUPPRIMER', 'ENTITE_SUPPRIMER',
];

// Catalogue configurable des categories d'employe (voir decision du 29/07 :
// "role et categorie c'est la meme chose" — une seule table qui porte a la
// fois le taux de frais/perdiem (ExpenseConfig) ET le paquet de permissions
// copie au user cree pour un employe de cette categorie). Librement
// modifiable/ajoutable ensuite depuis l'ecran Configuration > Classification —
// ceci n'est qu'un point de depart : les 4 memes paliers que l'ancien systeme
// de roles mock cote front (employee/validator/hr_admin/hr_director, voir
// decision du 29/07).
const CATEGORIES: { Code: string; Name: string; Permissions: string[] }[] = [
  { Code: 'EMPLOYE', Name: 'Employé', Permissions: [] },
  { Code: 'MANAGER', Name: 'Manager', Permissions: VALIDATEUR_PERMISSIONS },
  { Code: 'ADMIN-RH', Name: 'Admin RH', Permissions: ADMIN_RH_PERMISSIONS },
  { Code: 'DIRECTEUR-RH', Name: 'Directeur RH', Permissions: DIRECTEUR_RH_PERMISSIONS },
];

// `Employee.UserId String? @unique` genere par `prisma db push` sur SQL
// Server une UNIQUE CONSTRAINT classique (non filtree) — contrairement a
// Postgres/MySQL, SQL Server n'autorise alors qu'UNE SEULE ligne NULL au
// total sur toute la colonne. Resultat : creer un 2e employe sans compte
// utilisateur (UserId=NULL, le cas normal avant "Creer un compte") declenche
// un faux conflit "Cette valeur est deja utilisee" des le 2e employe sans
// compte. On remplace la contrainte par un INDEX UNIQUE FILTRE (autorise
// plusieurs NULL, empeche toujours deux employes de partager le meme compte)
// — a refaire a chaque `db push`, qui regenere sinon la contrainte naive.
async function fixEmployeeUserIdUniqueIndex() {
  const [existing] = await prisma.$queryRawUnsafe<{ has_filter: boolean }[]>(`
    SELECT i.has_filter
    FROM sys.indexes i
    JOIN sys.tables t ON t.object_id = i.object_id
    WHERE t.name = 'Employee' AND i.name = 'Employee_UserId_key'
  `);
  if (!existing || existing.has_filter) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE Employee DROP CONSTRAINT Employee_UserId_key`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE NONCLUSTERED INDEX Employee_UserId_key ON Employee(UserId) WHERE UserId IS NOT NULL`,
  );
  console.log('Index Employee.UserId converti en index unique filtré (plusieurs NULL autorisés).');
}

async function main() {
  await fixEmployeeUserIdUniqueIndex();

  const existingAdminEmployee = await prisma.employee.findFirst({
    where: { Email: ADMIN_EMAIL },
  });

  const existingCategory = await prisma.employeeCategory.findFirst();
  if (existingCategory) {
    if (existingAdminEmployee) await seedExpenseTypeAutre(existingAdminEmployee.Id);
    console.log('Des catégories existent déjà — seed ignoré.');
    return;
  }

  // ── Permissions (catalogue fixe) ──────────────────────────────
  const permissionByCode = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { Code: p.Code },
      update: { Label: p.Label, Module: p.Module },
      create: p,
    });
    permissionByCode.set(p.Code, created.Id);
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions.`);

  if (existingAdminEmployee) {
    // Un employe admin existe deja (base anterieure a cette migration) mais
    // aucune categorie n'existe encore : on cree les 4 categories + on relie
    // le compte existant a Directeur RH, avec une copie de ses permissions
    // (voir UserService.create — ici on le refait a la main, ce chemin ne
    // passe pas par ce service), sans repasser par le bootstrap OrganizationUnit ci-dessous.
    const categoryIdByName = await seedCategories(existingAdminEmployee.Id, permissionByCode);
    const directeurRhId = categoryIdByName.get('Directeur RH') as string;
    if (existingAdminEmployee.UserId) {
      await prisma.user.update({
        where: { Id: existingAdminEmployee.UserId },
        data: { EmployeeCategoryId: directeurRhId },
      });
      await snapshotCategoryPermissions(
        existingAdminEmployee.UserId,
        directeurRhId,
        existingAdminEmployee.Id,
      );
      console.log(`Compte ${ADMIN_EMAIL} relié à la catégorie Directeur RH.`);
    }
    await seedExpenseTypeAutre(existingAdminEmployee.Id);
    return;
  }

  // ── Aucun employe admin : bootstrap complet (categories + org + employe + user) ──
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const employeeId = randomUUID();
  const orgUnitId = randomUUID();

  // OrganizationUnit.CreatedBy, EmployeeCategory.CreatedBy et
  // CategoryPermission.CreatedBy sont des FK requises vers Employee, mais le
  // tout premier Employee ne peut pas exister avant sa propre
  // OrganizationUnit (ni les categories creees pour lui) — un vrai cycle de
  // bootstrap. Desactive temporairement ces contraintes FK pour les inserts
  // ci-dessous, puis les reactive (et revalide) une fois chaque ligne en
  // place. Employee.CreatedBy lui-meme est auto-referencee et n'a besoin
  // d'aucun contournement : SQL Server valide une FK auto-referencee contre
  // la ligne en cours d'insertion dans la meme instruction.
  const fks = await prisma.$queryRaw<{ table_name: string; fk_name: string }[]>`
    SELECT OBJECT_NAME(fk.parent_object_id) AS table_name, fk.name AS fk_name
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id = OBJECT_ID('dbo.Employee')
      AND fk.parent_object_id IN (
        OBJECT_ID('dbo.OrganizationUnit'), OBJECT_ID('dbo.EmployeeCategory'), OBJECT_ID('dbo.CategoryPermission')
      )
      AND EXISTS (
        SELECT 1 FROM sys.foreign_key_columns fkc
        JOIN sys.columns c
          ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
        WHERE fkc.constraint_object_id = fk.object_id AND c.name = 'CreatedBy'
      )
  `;

  for (const fk of fks) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE dbo.[${fk.table_name}] NOCHECK CONSTRAINT [${fk.fk_name}]`,
    );
  }

  let categoryIdByName = new Map<string, string>();
  try {
    categoryIdByName = await seedCategories(employeeId, permissionByCode);
    const directeurRhId = categoryIdByName.get('Directeur RH') as string;

    await prisma.organizationUnit.create({
      data: {
        Id: orgUnitId,
        Code: 'DG',
        Name: 'Direction Generale',
        Type: 'Direction',
        Status: 'Active',
        CreatedBy: employeeId,
      },
    });

    const user = await prisma.user.create({
      data: {
        Username: 'admin',
        Email: ADMIN_EMAIL,
        PasswordHash: passwordHash,
        IsActive: true,
        EmployeeCategoryId: directeurRhId,
      },
    });

    await prisma.employee.create({
      data: {
        Id: employeeId,
        EmployeeNumber: 'GAL-0001',
        FirstName: 'Admin',
        LastName: 'Galana',
        FullName: 'Admin Galana',
        Gender: 'M',
        BirthDate: new Date('1990-01-01'),
        MaritalStatus: 'Single',
        IdType: 'NationalId',
        Email: ADMIN_EMAIL,
        ContractType: 'Permanent',
        HireDate: new Date(),
        OrganizationUnitId: orgUnitId,
        UserId: user.Id,
        Status: 'Active',
        IsSystem: true,
        CreatedBy: employeeId,
      },
    });

    await snapshotCategoryPermissions(user.Id, directeurRhId, employeeId);
  } finally {
    for (const fk of fks) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE dbo.[${fk.table_name}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`,
      );
    }
  }

  await seedExpenseTypeAutre(employeeId);

  // Le responsable de l'entite racine n'est PAS force sur l'admin technique —
  // il doit etre choisi deliberement depuis la fiche entite (le boss n'est
  // pas forcement le compte qui a lance le seed).

  console.log('Seeded first admin account:');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

// Type de frais systeme "Autre" (Code AUTRE, IsSystem=true) — secours par
// defaut toujours disponible dans le dropdown "Categorie" d'une ligne de
// mission/note de frais, meme si la configuration a oublie un cas (decision
// du 12/08). Idempotent et appele a chaque execution du seed (pas seulement
// au tout premier bootstrap), pour ne jamais le manquer sur une base deja
// peuplee (ancien role du script ponctuel backfill-expense-type-autre.ts,
// desormais couvert directement ici).
async function seedExpenseTypeAutre(createdBy: string) {
  const existing = await prisma.expenseType.findFirst({ where: { Code: 'AUTRE' } });
  if (existing) {
    if (!existing.IsSystem || !existing.IsActive) {
      await prisma.expenseType.update({ where: { Id: existing.Id }, data: { IsSystem: true, IsActive: true } });
    }
    return;
  }
  await prisma.expenseType.create({
    data: { Code: 'AUTRE', Name: 'Autre', Unit: 'PerItem', IsActive: true, IsSystem: true, CreatedBy: createdBy },
  });
  console.log('Type de frais "Autre" créé (IsSystem=true).');
}

// Cree les categories + leurs CategoryPermission, retourne la table Nom -> Id
// (utilisee pour relier le compte admin a Directeur RH ci-dessus).
async function seedCategories(createdBy: string, permissionByCode: Map<string, string>): Promise<Map<string, string>> {
  const categoryIdByName = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await prisma.employeeCategory.create({
      data: { Code: c.Code, Name: c.Name, CreatedBy: createdBy },
    });
    if (c.Permissions.length > 0) {
      await prisma.categoryPermission.createMany({
        data: c.Permissions.map((code) => ({
          EmployeeCategoryId: category.Id,
          PermissionId: permissionByCode.get(code) as string,
          CreatedBy: createdBy,
        })),
      });
    }
    categoryIdByName.set(c.Name, category.Id);
  }
  console.log(`Seeded ${CATEGORIES.length} catégories.`);
  return categoryIdByName;
}

// Copie les permissions actuelles d'une categorie vers un user — le meme
// geste que UserService.create() fait pour toute creation de compte via
// l'API, ici refait a la main car le seed insere directement en base (voir
// decision du 29/07 : une seule copie, jamais re-synchronisee ensuite).
async function snapshotCategoryPermissions(userId: string, categoryId: string, createdBy: string) {
  const categoryPermissions = await prisma.categoryPermission.findMany({
    where: { EmployeeCategoryId: categoryId },
  });
  if (categoryPermissions.length === 0) return;
  await prisma.userPermission.createMany({
    data: categoryPermissions.map((cp) => ({
      UserId: userId,
      PermissionId: cp.PermissionId,
      CreatedBy: createdBy,
    })),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
