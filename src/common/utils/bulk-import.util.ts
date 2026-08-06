import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export interface BulkImportError {
  index: number;
  message: string;
}

export interface BulkImportResult {
  succeeded: number;
  failed: number;
  errors: BulkImportError[];
}

// Import CSV (Lot D) : chaque ligne est validee et creee independamment,
// une ligne en erreur n'empeche pas les autres de passer — contrairement au
// ValidationPipe global (whitelist/forbidNonWhitelisted, voir main.ts) qui
// rejetterait tout le lot au premier champ invalide. Les endpoints /bulk
// recoivent donc des items non-types (voir BulkImportDto), valides ici un a
// un avec les memes decorateurs class-validator que la creation unitaire.
//
// Sequentiel (pas Promise.all) volontairement : certains createFn generent
// un identifiant en comptant les lignes existantes (ex: EmployeeNumber) ou
// verifient une capacite au moment de l'ecriture — un traitement parallele
// pourrait produire des doublons ou des courses sur ces verifications.
export async function bulkImport<TDto extends object>(
  items: unknown[],
  DtoClass: new () => TDto,
  createFn: (dto: TDto) => Promise<unknown>,
): Promise<BulkImportResult> {
  const result: BulkImportResult = { succeeded: 0, failed: 0, errors: [] };

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const dto = plainToInstance(DtoClass, raw, { excludeExtraneousValues: false });
    const validationErrors = await validate(dto as object, { whitelist: true, forbidNonWhitelisted: false });

    if (validationErrors.length > 0) {
      const message = validationErrors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join(' ; ');
      result.failed++;
      result.errors.push({ index: i, message: message || 'Ligne invalide' });
      continue;
    }

    try {
      await createFn(dto);
      result.succeeded++;
    } catch (err) {
      result.failed++;
      result.errors.push({
        index: i,
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    }
  }

  return result;
}
