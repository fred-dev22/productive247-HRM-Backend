import { ForbiddenException } from '@nestjs/common';

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
