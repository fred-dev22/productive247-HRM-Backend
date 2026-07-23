import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';

// Libellés français (article + nom) des champs @unique du schéma Prisma,
// utilisés pour construire un message de conflit lisible à partir du nom de
// champ brut renvoyé dans PrismaClientKnownRequestError.meta (P2002).
const FIELD_LABELS: Record<string, { label: string; noun: string }> = {
  Code: { label: 'Le code', noun: 'code' },
  Email: { label: "L'email", noun: 'email' },
  Username: { label: "Le nom d'utilisateur", noun: "nom d'utilisateur" },
  EmployeeNumber: { label: 'Le matricule', noun: 'matricule' },
  UserId: { label: 'Ce compte utilisateur', noun: 'compte utilisateur' },
  ReferenceCode: { label: 'Le code de référence', noun: 'code de référence' },
  CalendarId: { label: 'Le calendrier', noun: 'calendrier' },
  DayOfWeek: { label: 'Le jour de la semaine', noun: 'jour de la semaine' },
  EmployeeCategoryId: {
    label: "La catégorie d'employé",
    noun: "catégorie d'employé",
  },
  ExpenseTypeId: { label: 'Le type de frais', noun: 'type de frais' },
  MissionCategory: {
    label: 'La catégorie de mission',
    noun: 'catégorie de mission',
  },
};

// Le connecteur SQL Server ne renvoie pas toujours `meta.target` (liste de
// champs) comme les autres connecteurs Prisma : il peut exposer le nom brut
// de la contrainte d'index à la place. On retombe alors sur la convention de
// nommage par défaut de Prisma `<Model>_<Champ1>_..._key` pour retrouver le
// ou les champs en conflit.
export function extractConflictingFields(
  meta: Record<string, unknown> | undefined,
): string[] {
  if (!meta) return [];

  const { target, constraint } = meta as {
    target?: unknown;
    constraint?: unknown;
  };
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string') return [target];

  if (constraint && typeof constraint === 'object') {
    const index = (constraint as { index?: unknown }).index;
    if (typeof index === 'string') {
      const match = index.match(/^[A-Za-z]+_(.+)_key$/);
      if (match) return match[1].split('_');
    }
  }

  return [];
}

function toDisplayValue(value: unknown): string | undefined {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : undefined;
}

export function buildConflictMessage(
  fields: string[],
  body: Record<string, unknown> | undefined,
): string {
  if (fields.length === 0) {
    return 'Cette valeur est déjà utilisée.';
  }

  if (fields.length === 1) {
    const [field] = fields;
    const value = toDisplayValue(body?.[field]);
    const label = FIELD_LABELS[field];
    if (label) {
      return value !== undefined
        ? `${label.label} "${value}" est déjà utilisé.`
        : `${label.label} est déjà utilisé.`;
    }
    return value !== undefined
      ? `Le champ "${field}" a la valeur "${value}" qui est déjà utilisée.`
      : `Le champ "${field}" est déjà utilisé.`;
  }

  const nouns = fields.map((field) => FIELD_LABELS[field]?.noun ?? field);
  return `Cette combinaison (${nouns.join(', ')}) existe déjà.`;
}

/**
 * Filtre global qui transforme les erreurs Prisma connues en réponses HTTP
 * appropriées. Actuellement : P2002 (violation de contrainte unique) → 409
 * Conflict avec un message français identifiant le champ en conflit, plutôt
 * que le 500 Internal Server Error par défaut.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code !== 'P2002') {
      super.catch(exception, host);
      return;
    }

    const request = host.switchToHttp().getRequest<Request>();
    const fields = extractConflictingFields(exception.meta);
    const message = buildConflictMessage(
      fields,
      request?.body as Record<string, unknown> | undefined,
    );

    super.catch(new ConflictException(message), host);
  }
}
