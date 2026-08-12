// Script ponctuel : cree le type de frais systeme "Autre" (Code AUTRE,
// IsSystem=true) s'il n'existe pas deja — c'est le secours par defaut
// toujours disponible dans le dropdown "Categorie" d'une ligne de note de
// frais, meme si la configuration a oublie un cas (decision du 12/08).
// Idempotent : ne fait rien si le type existe deja.
import 'dotenv/config';
import { PrismaClient } from './generated/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const prisma = new PrismaClient({
  adapter: new PrismaMssql(process.env.DATABASE_URL as string),
});

async function main() {
  const existing = await prisma.expenseType.findFirst({ where: { Code: 'AUTRE' } });
  if (existing) {
    if (!existing.IsSystem) {
      await prisma.expenseType.update({ where: { Id: existing.Id }, data: { IsSystem: true, IsActive: true } });
      console.log('Type de frais "AUTRE" existant marqué IsSystem=true.');
    } else {
      console.log('Type de frais "AUTRE" déjà présent, rien à faire.');
    }
    return;
  }

  const admin = await prisma.employee.findFirst({ where: { EmployeeNumber: 'GAL-0001' } });
  if (!admin) {
    throw new Error('Compte admin (GAL-0001) introuvable — impossible de définir CreatedBy pour le type "Autre".');
  }

  await prisma.expenseType.create({
    data: {
      Code: 'AUTRE',
      Name: 'Autre',
      Unit: 'PerItem',
      IsActive: true,
      IsSystem: true,
      CreatedBy: admin.Id,
    },
  });
  console.log('Type de frais "Autre" créé (IsSystem=true).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
