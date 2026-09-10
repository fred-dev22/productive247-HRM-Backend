/**
 * Donnees d'amorcage du module Recrutement (branche dev-recrutement-module).
 * Idempotent : ne cree que ce qui manque, repere par ReferenceCode / Name.
 * A lancer une fois en local :  npx ts-node prisma/seed-recruitment.ts
 *
 * Reprend le jeu de donnees fictif du front (src/stores/recruitment/mockSeed.ts)
 * pour que la demo ait du contenu, avec "Galana" remplace par "HV".
 */
import 'dotenv/config';
import { PrismaClient } from './generated/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL as string) });

const CONTRACT_TEMPLATES = [
  {
    Name: 'CDI standard',
    ContractType: 'CDI',
    Content:
      'Entre HV et {{nom_candidat}}, il est convenu un contrat a duree indeterminee pour le poste de {{poste}} au sein de {{entite}}, a compter du {{date_debut}}, moyennant une remuneration mensuelle brute de {{salaire}} Ariary.',
  },
  {
    Name: 'CDD standard',
    ContractType: 'CDD',
    Content:
      'Entre HV et {{nom_candidat}}, il est convenu un contrat a duree determinee pour le poste de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant une remuneration mensuelle brute de {{salaire}} Ariary.',
  },
  {
    Name: 'Convention de stage',
    ContractType: 'Stage',
    Content:
      'Entre HV et {{nom_candidat}}, il est convenu une convention de stage pour le poste de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant une gratification mensuelle de {{salaire}} Ariary.',
  },
  {
    Name: 'Prestation freelance',
    ContractType: 'Freelance',
    Content:
      'Entre HV et {{nom_candidat}}, il est convenu un contrat de prestation de services pour la mission de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant des honoraires mensuels de {{salaire}} Ariary.',
  },
  {
    Name: "Contrat d'apprentissage",
    ContractType: 'Apprenti',
    Content:
      "Entre HV et {{nom_candidat}}, il est convenu un contrat d'apprentissage pour le poste de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant une remuneration mensuelle de {{salaire}} Ariary.",
  },
  {
    Name: 'Contrat de professionnalisation',
    ContractType: 'Alternant',
    Content:
      'Entre HV et {{nom_candidat}}, il est convenu un contrat de professionnalisation pour le poste de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant une remuneration mensuelle de {{salaire}} Ariary.',
  },
  {
    Name: "Periode d'essai",
    ContractType: 'Essai',
    Content:
      "Entre HV et {{nom_candidat}}, il est convenu une periode d'essai pour le poste de {{poste}} au sein de {{entite}}, du {{date_debut}} au {{date_fin}}, moyennant une remuneration mensuelle brute de {{salaire}} Ariary.",
  },
];

const EVAL_TEMPLATES = [
  { Name: 'Grille standard', Criteria: ['Competences techniques', 'Communication', 'Motivation', 'Adequation culturelle'] },
  { Name: 'Grille poste terrain', Criteria: ['Experience pratique', 'Respect des consignes de securite', 'Autonomie', 'Ponctualite'] },
];

const HIRING_REQUESTS = [
  {
    ReferenceCode: 'RB-2026-00001',
    PositionTitle: 'Comptable',
    EntityName: 'Direction Finance',
    Headcount: 1,
    Profile: "Bac+3 en comptabilite, 2 ans d'experience minimum, maitrise Excel avance.",
    Status: 'Open',
  },
  {
    ReferenceCode: 'RB-2026-00002',
    PositionTitle: 'Technicien de maintenance',
    EntityName: 'Direction Exploitation',
    Headcount: 2,
    Profile: 'BTS maintenance industrielle, disponible pour astreintes.',
    Status: 'Open',
  },
  {
    ReferenceCode: 'RB-2026-00003',
    PositionTitle: 'Assistant RH',
    EntityName: 'Direction des Ressources Humaines',
    Headcount: 1,
    Profile: 'Bac+2 RH minimum, bon relationnel, a l\'aise avec les outils bureautiques.',
    Status: 'Draft',
  },
];

const JOB_OFFERS = [
  {
    ReferenceCode: 'OF-2026-00001',
    Title: 'Comptable',
    EntityName: 'Direction Finance',
    ContractType: 'CDI',
    Location: 'Antananarivo',
    Description:
      'Sous la responsabilite du Directeur Financier, vous prenez en charge la comptabilite generale et auxiliaire, les rapprochements bancaires et la preparation des situations mensuelles.',
    Status: 'Published',
    Views: 214,
  },
  {
    ReferenceCode: 'OF-2026-00002',
    Title: 'Chauffeur poids lourd',
    EntityName: 'Direction Exploitation',
    ContractType: 'CDD',
    Location: 'Toamasina',
    Description:
      'Conduite de camions-citernes sur le reseau national, respect strict des consignes de securite transport de matieres dangereuses.',
    Status: 'Published',
    Views: 356,
  },
  {
    ReferenceCode: 'OF-2026-00003',
    Title: 'Stagiaire communication',
    EntityName: 'Direction Generale',
    ContractType: 'Stage',
    Location: 'Antananarivo',
    Description:
      "Appui a l'equipe communication sur les supports internes et les reseaux sociaux, stage de 6 mois.",
    Status: 'Published',
    Views: 42,
  },
  {
    ReferenceCode: 'OF-2026-00004',
    Title: 'Responsable QHSE',
    EntityName: 'Direction Generale',
    ContractType: 'CDI',
    Location: 'Antananarivo',
    Description:
      "Pilotage de la politique qualite, hygiene, securite et environnement sur l'ensemble des sites HV.",
    Status: 'Draft',
    Views: 0,
  },
];

const APPLICATIONS = [
  { ReferenceCode: 'CD-2026-00001', Offer: 'OF-2026-00001', CandidateName: 'Fara Ratsimbazafy', CandidateEmail: 'fara.ratsimbazafy@example.com', CandidatePhone: '034 12 345 67', Source: 'Offer', CvFileName: 'CV_Fara_Ratsimbazafy.pdf', Status: 'InReview' },
  { ReferenceCode: 'CD-2026-00002', Offer: 'OF-2026-00001', CandidateName: 'Tojo Randrianasolo', CandidateEmail: 'tojo.randrianasolo@example.com', CandidatePhone: '033 98 765 43', Source: 'Offer', CvFileName: 'CV_Tojo_Randrianasolo.pdf', Status: 'New' },
  { ReferenceCode: 'CD-2026-00003', Offer: 'OF-2026-00002', CandidateName: 'Lova Rakotomalala', CandidateEmail: 'lova.rakoto@example.com', CandidatePhone: '032 44 556 78', Source: 'Offer', CvFileName: 'CV_Lova_Rakotomalala.pdf', Status: 'Retained' },
  { ReferenceCode: 'CD-2026-00004', Offer: null, CandidateName: 'Miora Andriantsoa', CandidateEmail: 'miora.andriantsoa@example.com', CandidatePhone: '033 77 889 90', Source: 'Spontaneous', CvFileName: 'CV_Miora_Andriantsoa.pdf', Status: 'New' },
];

async function main() {
  const admin = await prisma.employee.findFirst({ where: { Email: 'admin@galana.com' } });
  if (!admin) throw new Error('admin employee introuvable');
  const by = admin.Id;

  for (const t of CONTRACT_TEMPLATES) {
    const exists = await prisma.contractTemplate.findFirst({ where: { Name: t.Name, IsDeleted: false } });
    if (!exists) {
      await prisma.contractTemplate.create({ data: { ...t, CreatedBy: by } });
      console.log(`+ modele contrat "${t.Name}"`);
    }
  }

  for (const t of EVAL_TEMPLATES) {
    const exists = await prisma.interviewEvaluationTemplate.findFirst({ where: { Name: t.Name, IsDeleted: false } });
    if (!exists) {
      await prisma.interviewEvaluationTemplate.create({
        data: {
          Name: t.Name,
          CreatedBy: by,
          criteria: { create: t.Criteria.map((Label, Position) => ({ Label, Position })) },
        },
      });
      console.log(`+ grille evaluation "${t.Name}"`);
    }
  }

  for (const h of HIRING_REQUESTS) {
    const exists = await prisma.hiringRequest.findUnique({ where: { ReferenceCode: h.ReferenceCode } });
    if (!exists) {
      await prisma.hiringRequest.create({ data: { ...h, CreatedBy: by } });
      console.log(`+ besoin ${h.ReferenceCode}`);
    }
  }

  const { randomBytes } = await import('crypto');
  for (const o of JOB_OFFERS) {
    const exists = await prisma.jobOffer.findUnique({ where: { ReferenceCode: o.ReferenceCode } });
    if (!exists) {
      await prisma.jobOffer.create({
        data: {
          ...o,
          PublishedAt: o.Status === 'Published' ? new Date('2026-08-06') : null,
          PublicToken: randomBytes(24).toString('hex'),
          CreatedBy: by,
        },
      });
      console.log(`+ offre ${o.ReferenceCode}`);
    }
  }

  for (const a of APPLICATIONS) {
    const exists = await prisma.recruitmentApplication.findUnique({ where: { ReferenceCode: a.ReferenceCode } });
    if (!exists) {
      const offer = a.Offer ? await prisma.jobOffer.findUnique({ where: { ReferenceCode: a.Offer } }) : null;
      await prisma.recruitmentApplication.create({
        data: {
          ReferenceCode: a.ReferenceCode,
          JobOfferId: offer?.Id,
          JobOfferTitle: offer?.Title,
          CandidateName: a.CandidateName,
          CandidateEmail: a.CandidateEmail,
          CandidatePhone: a.CandidatePhone,
          Source: a.Source,
          CvFileName: a.CvFileName,
          Status: a.Status,
          AppliedAt: new Date('2026-08-10'),
          CreatedBy: by,
        },
      });
      console.log(`+ candidature ${a.ReferenceCode}`);
    }
  }

  console.log('Seed recrutement OK');
}

main().finally(() => prisma.$disconnect());
