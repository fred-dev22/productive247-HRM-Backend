import { PrismaService } from '../../prisma/prisma.service';

// Regle unique de resolution des validateurs, partagee par les conges, les
// missions et les notes de frais (retour client du 04/11 : l'interimaire doit
// pouvoir valider a tout moment, pas seulement pendant un conge approuve du
// titulaire).
//
// Quand un validateur a un interimaire, celui-ci recoit la demande en meme temps
// que le titulaire, a tout moment. L'un ou l'autre peut decider : la decision
// enregistre qui a agi et la demande sort de la liste de l'autre.

export interface ApproverSpec {
  EmployeeId: string;
  InterimEmployeeId: string | null;
}

export interface ResolvedApprovers {
  // Destinataire principal : porte le lien de validation par email et
  // ApprovalDecision.ValidatedByEmployeeId a la creation de l'etape.
  primary: string;
  // Tous ceux qui peuvent decider (primary en premier).
  all: string[];
}

export function resolveApprovers(spec: ApproverSpec): ResolvedApprovers {
  const interim = spec.InterimEmployeeId;
  if (!interim || interim === spec.EmployeeId) return { primary: spec.EmployeeId, all: [spec.EmployeeId] };
  return { primary: spec.EmployeeId, all: [spec.EmployeeId, interim] };
}

// Premier niveau dont le validateur principal n'est pas le demandeur : un
// validateur ne doit jamais rester bloque en attente de sa propre validation.
// Le demandeur est exclu des co-validateurs. undefined si tous les niveaux
// restants resolvent au demandeur (approbation automatique).
export function findApplicableStep<T extends ApproverSpec & { StepOrder: number }>(
  sortedMembers: T[],
  requesterEmployeeId: string,
): { member: T; approverId: string; coApproverIds: string[] } | undefined {
  for (const member of sortedMembers) {
    const { primary, all } = resolveApprovers(member);
    if (primary === requesterEmployeeId) continue;
    return { member, approverId: primary, coApproverIds: all.filter((id) => id !== primary && id !== requesterEmployeeId) };
  }
  return undefined;
}

export function canDecide(resolved: ResolvedApprovers, employeeId: string): boolean {
  return resolved.all.includes(employeeId);
}

// Validateur direct (Employee.DirectValidatorId) : son interimaire est porte par
// sa propre fiche employe (ValidatorInterimId).
export async function directValidatorSpec(
  prisma: Pick<PrismaService, 'employee'>,
  validatorId: string,
): Promise<ApproverSpec> {
  const v = await prisma.employee.findUnique({ where: { Id: validatorId }, select: { ValidatorInterimId: true } });
  return { EmployeeId: validatorId, InterimEmployeeId: v?.ValidatorInterimId ?? null };
}
