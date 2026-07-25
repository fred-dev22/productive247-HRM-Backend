// DEV UNIQUEMENT — efface entierement le contenu de la base de donnees puis
// relance le seed, pour retrouver un espace vierge comme au tout premier
// lancement (utile pour retester l'onboarding depuis zero).
//
// Usage : npm run db:reset -- --yes
//
// Double garde-fou : refuse si NODE_ENV=production, et exige le flag --yes
// explicite (pas d'execution accidentelle via un simple "npm run db:reset").
import 'dotenv/config';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refuse : ce script ne doit jamais tourner en production.');
    process.exit(1);
  }
  if (!process.argv.includes('--yes')) {
    console.error(
      'Ce script efface DEFINITIVEMENT toutes les donnees de la base.\n' +
        'Relancez avec : npm run db:reset -- --yes',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL as string) });

  console.log('Suppression de toutes les données…');
  // sp_MSforeachtable : desactive les contraintes, vide chaque table, puis
  // reactive les contraintes — evite d'avoir a lister manuellement l'ordre
  // de suppression au milieu de toutes les FK du schema.
  await prisma.$executeRawUnsafe(`EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL"`);
  await prisma.$executeRawUnsafe(`EXEC sp_MSforeachtable "DELETE FROM ?"`);
  await prisma.$executeRawUnsafe(`EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL"`);
  await prisma.$disconnect();
  console.log('Base vidée.');

  console.log('Relance du seed…');
  execSync('npx prisma db seed', { stdio: 'inherit', cwd: process.cwd() });

  console.log('Espace réinitialisé — comme au premier lancement.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
