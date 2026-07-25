// Script ponctuel : seed.ts s'arrête tôt dès qu'un rôle existe déjà (voir
// main()), donc relancer le seed complet ne propage pas les nouvelles
// permissions ajoutées après le premier seed. Ce script upsert juste la
// permission CONFIG_METIERS_POSTES et l'assigne à Admin RH + Directeur RH sur
// une base déjà seedée. À supprimer une fois exécuté en prod si besoin — la
// définition canonique reste seed.ts pour les installations neuves.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const prisma = new PrismaClient({
  adapter: new PrismaMssql(process.env.DATABASE_URL as string),
});

async function main() {
  const permission = await prisma.permission.upsert({
    where: { Code: 'CONFIG_METIERS_POSTES' },
    update: { Label: 'Configurer les métiers et postes', Module: 'Configuration' },
    create: { Code: 'CONFIG_METIERS_POSTES', Label: 'Configurer les métiers et postes', Module: 'Configuration' },
  });

  const roles = await prisma.role.findMany({
    where: { Name: { in: ['Admin RH', 'Directeur RH'] } },
  });

  for (const role of roles) {
    await prisma.rolePermission.upsert({
      where: { RoleId_PermissionId: { RoleId: role.Id, PermissionId: permission.Id } },
      update: {},
      create: { RoleId: role.Id, PermissionId: permission.Id },
    });
    console.log(`Permission accordée à ${role.Name}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
