import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaMssql(process.env.DATABASE_URL as string),
});

const ADMIN_EMAIL = 'admin@galana.com';
const ADMIN_PASSWORD = 'Admin@2026!';

// Catalogue fixe des 27 permissions — jamais modifiable depuis l'UI, seule
// l'association Role <-> Permission l'est (ecran Administration > Roles).
const PERMISSIONS: { Code: string; Label: string; Module: string }[] = [
  { Code: 'CONGE_VOIR_EQUIPE', Label: "Voir les demandes de congé de son équipe", Module: 'Congés' },
  { Code: 'CONGE_VOIR_TOUT', Label: 'Voir toutes les demandes de congé', Module: 'Congés' },
  { Code: 'CONGE_VALIDER', Label: 'Valider / rejeter une demande de congé', Module: 'Congés' },

  { Code: 'MISSION_VOIR_EQUIPE', Label: "Voir les ordres de mission de son équipe", Module: 'Missions' },
  { Code: 'MISSION_VOIR_TOUT', Label: 'Voir tous les ordres de mission', Module: 'Missions' },
  { Code: 'MISSION_VALIDER', Label: 'Valider / rejeter un ordre de mission', Module: 'Missions' },

  { Code: 'FRAIS_VOIR_EQUIPE', Label: "Voir les notes de frais de son équipe", Module: 'Notes de frais' },
  { Code: 'FRAIS_VOIR_TOUT', Label: 'Voir toutes les notes de frais', Module: 'Notes de frais' },
  { Code: 'FRAIS_VALIDER', Label: 'Valider / rejeter une note de frais', Module: 'Notes de frais' },

  { Code: 'EMPLOYE_VOIR_EQUIPE', Label: 'Voir la fiche des employés de son équipe', Module: 'Employés' },
  { Code: 'EMPLOYE_VOIR_TOUT', Label: 'Voir la fiche de tous les employés', Module: 'Employés' },
  { Code: 'EMPLOYE_CREER', Label: 'Créer un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_MODIFIER', Label: 'Modifier un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_DESACTIVER', Label: 'Désactiver un employé', Module: 'Employés' },
  { Code: 'EMPLOYE_COMPTE_CREER', Label: "Créer un compte d'accès système pour un employé", Module: 'Employés' },
  { Code: 'EMPLOYE_PERMISSION_GERER', Label: 'Gérer les permissions individuelles des employés', Module: 'Employés' },

  { Code: 'ENTITE_VOIR', Label: "Voir la structure organisationnelle", Module: 'Entités' },
  { Code: 'ENTITE_CREER', Label: 'Créer une entité', Module: 'Entités' },
  { Code: 'ENTITE_MODIFIER', Label: 'Modifier une entité', Module: 'Entités' },
  { Code: 'ENTITE_SOUMETTRE', Label: 'Soumettre une entité pour approbation', Module: 'Entités' },
  { Code: 'ENTITE_APPROUVER', Label: 'Approuver / rejeter une entité', Module: 'Entités' },
  { Code: 'ENTITE_DESACTIVER', Label: 'Désactiver une entité', Module: 'Entités' },

  { Code: 'ROLE_GERER', Label: 'Gérer les rôles et leurs permissions', Module: 'Administration' },

  { Code: 'CONFIG_CALENDRIER', Label: 'Configurer le calendrier', Module: 'Configuration' },
  { Code: 'CONFIG_JOURS_FERIES', Label: 'Configurer les jours fériés', Module: 'Configuration' },
  { Code: 'CONFIG_TYPES_CONGE', Label: 'Configurer les types de congé', Module: 'Configuration' },
  { Code: 'CONFIG_CATEGORIES_EMPLOYE', Label: 'Configurer les catégories employé', Module: 'Configuration' },
  { Code: 'CONFIG_FRAIS_MISSION', Label: 'Configurer les types et configs de frais / mission', Module: 'Configuration' },

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
  'CONFIG_CALENDRIER', 'CONFIG_JOURS_FERIES', 'CONFIG_TYPES_CONGE', 'CONFIG_CATEGORIES_EMPLOYE', 'CONFIG_FRAIS_MISSION',
  'RAPPORT_VOIR', 'RAPPORT_EXPORTER',
];

const DIRECTEUR_RH_PERMISSIONS = [
  ...ADMIN_RH_PERMISSIONS,
  'ENTITE_APPROUVER', 'ENTITE_DESACTIVER',
  'EMPLOYE_PERMISSION_GERER', 'ROLE_GERER',
];

const ROLES: { Name: string; Description: string; Permissions: string[] }[] = [
  { Name: 'Employé', Description: "Accès de base — ses propres données uniquement", Permissions: [] },
  { Name: 'Validateur', Description: "Valide les demandes de son équipe", Permissions: VALIDATEUR_PERMISSIONS },
  { Name: 'Admin RH', Description: 'Gestion RH courante', Permissions: ADMIN_RH_PERMISSIONS },
  { Name: 'Directeur RH', Description: 'Accès complet, y compris administration des rôles', Permissions: DIRECTEUR_RH_PERMISSIONS },
];

async function main() {
  const existingRole = await prisma.role.findFirst();
  if (existingRole) {
    console.log('Des rôles existent déjà — seed ignoré.');
    return;
  }

  const existingAdminEmployee = await prisma.employee.findFirst({
    where: { Email: ADMIN_EMAIL },
  });

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
    // Un employe admin existe deja (base anterieure au RBAC) mais aucun role
    // n'existe encore : on cree les 4 roles + on relie le compte existant au
    // role Directeur RH, sans repasser par le bootstrap OrganizationUnit ci-dessous.
    const directeurRhId = await seedRoles(existingAdminEmployee.Id, permissionByCode);
    if (existingAdminEmployee.UserId) {
      await prisma.user.update({
        where: { Id: existingAdminEmployee.UserId },
        data: { RoleId: directeurRhId },
      });
      console.log(`Compte ${ADMIN_EMAIL} relié au rôle Directeur RH.`);
    }
    return;
  }

  // ── Aucun employe admin : bootstrap complet (roles + org + employe + user) ──
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const employeeId = randomUUID();
  const orgUnitId = randomUUID();

  // Both OrganizationUnit.CreatedBy and Role.CreatedBy are required FKs to
  // Employee, but the very first Employee cannot exist before its own
  // OrganizationUnit (and the roles created for it) do — a genuine bootstrap
  // cycle. Temporarily disable both FK constraints for the inserts below,
  // then re-enable (and re-validate) them once every row exists. Employee.
  // CreatedBy itself is self-referencing and needs no such workaround: SQL
  // Server validates a self-FK against the row being inserted in the same
  // statement.
  const fks = await prisma.$queryRaw<{ table_name: string; fk_name: string }[]>`
    SELECT OBJECT_NAME(fk.parent_object_id) AS table_name, fk.name AS fk_name
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id = OBJECT_ID('dbo.Employee')
      AND fk.parent_object_id IN (OBJECT_ID('dbo.OrganizationUnit'), OBJECT_ID('dbo.Role'))
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

  let directeurRhId = '';
  try {
    directeurRhId = await seedRoles(employeeId, permissionByCode);

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
        RoleId: directeurRhId,
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
        CreatedBy: employeeId,
      },
    });
  } finally {
    for (const fk of fks) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE dbo.[${fk.table_name}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`,
      );
    }
  }

  await prisma.organizationUnit.update({
    where: { Id: orgUnitId },
    data: { ManagerId: employeeId },
  });

  console.log('Seeded first admin account:');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

// Cree les 4 roles systeme + leurs RolePermission, retourne l'Id du role
// Directeur RH (utilise pour relier le compte admin).
async function seedRoles(createdBy: string, permissionByCode: Map<string, string>): Promise<string> {
  let directeurRhId = '';
  for (const r of ROLES) {
    const role = await prisma.role.create({
      data: {
        Name: r.Name,
        Description: r.Description,
        IsSystem: true,
        CreatedBy: createdBy,
      },
    });
    if (r.Permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: r.Permissions.map((code) => ({
          RoleId: role.Id,
          PermissionId: permissionByCode.get(code) as string,
        })),
      });
    }
    if (r.Name === 'Directeur RH') directeurRhId = role.Id;
  }
  console.log(`Seeded ${ROLES.length} rôles système.`);
  return directeurRhId;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
