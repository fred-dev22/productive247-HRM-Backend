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
  // sp_MSforeachtable est un proc systeme compile avec QUOTED_IDENTIFIER OFF —
  // ce reglage est fige a la compilation du proc et ignore le SET de notre
  // session, donc son DELETE echoue des qu'une table a un index filtre (ex.
  // Employee_UserId_key). On construit donc la liste des tables nous-memes et
  // on execute chaque DELETE directement, avec QUOTED_IDENTIFIER ON dans le
  // meme batch que la commande.
  const tables: { name: string }[] = await prisma.$queryRawUnsafe(
    `SELECT t.name FROM sys.tables t WHERE t.is_ms_shipped = 0`,
  );
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE [${name}] NOCHECK CONSTRAINT ALL`);
  }
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`SET QUOTED_IDENTIFIER ON; DELETE FROM [${name}]`);
  }
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE [${name}] WITH CHECK CHECK CONSTRAINT ALL`);
  }
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
