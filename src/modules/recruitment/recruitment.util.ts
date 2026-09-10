import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Code de reference lisible : PREFIX-ANNEE-00001. `countWithPrefix` compte
// les lignes deja existantes pour l'annee en cours (meme approche que les
// autres modules, voir ExpenseReportService.generateReferenceCode).
export async function nextReferenceCode(
  prefix: string,
  countWithPrefix: (startsWith: string) => Promise<number>,
): Promise<string> {
  const year = new Date().getFullYear();
  const p = `${prefix}-${year}-`;
  const count = await countWithPrefix(p);
  return `${p}${String(count + 1).padStart(5, '0')}`;
}

// nextReferenceCode est base sur un count() : deux creations concurrentes
// peuvent generer le meme code (@unique -> P2002). Ce helper rejoue une fois
// l'operation avec un code regenere avant de laisser remonter le conflit.
export async function withReferenceCodeRetry<T>(
  build: () => Promise<T>,
): Promise<T> {
  try {
    return await build();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      return build();
    }
    throw err;
  }
}

// Auteur (CreatedBy, FK NOT NULL) des lignes creees depuis le portail public
// (candidature, piece jointe...) : le compte systeme de l'amorçage si
// present, sinon n'importe quel employe. Un seul point d'implementation
// partage entre RecruitmentPublicService et RecruitmentAttachmentService.
export async function resolvePortalAuthorId(prisma: PrismaService): Promise<string> {
  const system = await prisma.employee.findFirst({ where: { IsSystem: true }, select: { Id: true } });
  if (system) return system.Id;
  const any = await prisma.employee.findFirstOrThrow({ select: { Id: true } });
  return any.Id;
}

// Tags du vivier : stockes en une chaine "a, b, c", exposes en tableau.
export function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function joinTags(tags: string[] | null | undefined): string {
  if (!tags?.length) return '';
  return tags.map((t) => t.trim()).filter(Boolean).join(', ');
}

// Acces au module : RECRUTEMENT_ACCES ouvre tout (decision client du 05/09).
// Utilise par les routes de l'expression de besoin, qui acceptent AUSSI les
// permissions dediees de l'espace Administration.
export function assertBesoinCanView(permissions: Set<string>): void {
  if (permissions.has('RECRUTEMENT_ACCES') || permissions.has('RECRUTEMENT_BESOIN_VOIR')) return;
  throw new ForbiddenException(
    "Vous n'avez pas la permission de voir les expressions de besoin en recrutement",
  );
}

export function assertBesoinCanExpress(permissions: Set<string>): void {
  if (permissions.has('RECRUTEMENT_ACCES') || permissions.has('RECRUTEMENT_BESOIN_EXPRIMER')) return;
  throw new ForbiddenException(
    "Vous n'avez pas la permission d'exprimer un besoin en recrutement",
  );
}

// Les transitions "recruteur" d'une expression de besoin (transformer en
// offre, clore) restent reservees au module.
export function assertRecruitmentAccess(permissions: Set<string>): void {
  if (permissions.has('RECRUTEMENT_ACCES')) return;
  throw new ForbiddenException('Action reservee au module Recrutement (RECRUTEMENT_ACCES)');
}
