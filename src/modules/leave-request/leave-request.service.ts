import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalPoolService } from '../approval-pool/approval-pool.service';
import { LeaveTransactionService } from '../leave-transaction/leave-transaction.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';

const DAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Statuts pendant lesquels une demande occupe un jour du calendrier de
// l'employe — utilise pour detecter les chevauchements.
const OVERLAPPING_STATUSES = [
  'Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4',
  'Approved', 'Registered', 'Done',
];

const EDITABLE_STATUSES = ['Draft', 'Returned'];

// Applique a chaque create/update mutant une demande — sans ça la reponse
// renvoyee par l'endpoint (utilisee par le front pour patcher sa liste en
// place) n'a pas employee/leaveType et la ligne s'affiche avec un nom et
// des initiales vides jusqu'au prochain rechargement complet.
const LEAVE_REQUEST_INCLUDE = {
  employee: { select: { Id: true, FullName: true, EmployeeNumber: true } },
  leaveType: true,
  interimEmployee: { select: { Id: true, FullName: true } },
} as const;

@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalPoolService: ApprovalPoolService,
    private readonly leaveTransactionService: LeaveTransactionService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────

  private async generateReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DMD-${year}-`;
    const count = await this.prisma.leaveRequest.count({
      where: { ReferenceCode: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  // Remonte OrganizationUnit.ParentId jusqu'a la racine — reutilise pour
  // savoir si un jour ferie "Local" s'applique a l'employe.
  private async collectAncestorUnitIds(unitId: string): Promise<string[]> {
    const ids: string[] = [unitId];
    let currentId: string | null = unitId;
    while (currentId) {
      const unit = await this.prisma.organizationUnit.findUnique({
        where: { Id: currentId },
        select: { ParentId: true },
      });
      currentId = unit?.ParentId ?? null;
      if (currentId) ids.push(currentId);
    }
    return ids;
  }

  private async computeWorkingDays(
    startDate: Date,
    endDate: Date,
    organizationUnitId: string,
  ): Promise<number> {
    if (endDate < startDate) {
      throw new BadRequestException('La date de fin doit être postérieure ou égale à la date de début');
    }

    const calendar = await this.prisma.calendar.findFirst({
      where: { IsDefault: true },
      include: { workDays: true },
    });
    if (!calendar) {
      throw new BadRequestException("Aucun calendrier par défaut n'est configuré — contactez le RH");
    }

    const holidays = await this.prisma.holiday.findMany();
    const applicableUnitIds = new Set(await this.collectAncestorUnitIds(organizationUnitId));

    const isHoliday = (date: Date): boolean => {
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return holidays.some((h) => {
        if (h.HolidayType === 'Local' && !(h.OrganizationUnitId && applicableUnitIds.has(h.OrganizationUnitId))) {
          return false;
        }
        const hd = h.Date;
        if (h.IsRecurring) {
          return hd.getUTCMonth() + 1 === Number(mm) && hd.getUTCDate() === Number(dd);
        }
        return (
          hd.getUTCFullYear() === date.getFullYear() &&
          hd.getUTCMonth() === date.getMonth() &&
          hd.getUTCDate() === date.getDate()
        );
      });
    };

    let count = 0;
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dayConfig = calendar.workDays.find((d) => d.DayOfWeek === DAY_KEYS[cur.getDay()]);
      if (dayConfig?.IsEnabled && !isHoliday(cur)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // Determine le validateur reel d'un membre de pool a une date donnee : le
  // titulaire, sauf s'il a une demande de conge Approuvee couvrant cette
  // date, auquel cas on route vers son interimaire declare — plus de plage
  // de dates saisie a la main sur l'interim, l'absence est detectee au
  // moment ou la demande arrive a ce niveau.
  private async resolveActualApprover(
    member: { EmployeeId: string; InterimEmployeeId: string | null },
    at: Date,
  ): Promise<string> {
    if (!member.InterimEmployeeId) return member.EmployeeId;
    const onApprovedLeave = await this.prisma.leaveRequest.findFirst({
      where: { EmployeeId: member.EmployeeId, Status: 'Approved', StartDate: { lte: at }, EndDate: { gte: at } },
    });
    return onApprovedLeave ? member.InterimEmployeeId : member.EmployeeId;
  }

  // Premier niveau (a partir de la liste triee fournie) dont le validateur
  // resolu n'est pas le demandeur lui-meme — un validateur ne doit jamais
  // rester bloque en attente de sa propre validation, que ce soit comme
  // titulaire ou comme interimaire du moment. undefined si tous les niveaux
  // restants resolvent au demandeur (approbation automatique complete).
  private async findApplicableStep<
    T extends { EmployeeId: string; InterimEmployeeId: string | null; StepOrder: number },
  >(sortedMembers: T[], requesterEmployeeId: string): Promise<{ member: T; approverId: string } | undefined> {
    for (const member of sortedMembers) {
      const approverId = await this.resolveActualApprover(member, new Date());
      if (approverId !== requesterEmployeeId) return { member, approverId };
    }
    return undefined;
  }

  private async assertNoOverlap(employeeId: string, startDate: Date, endDate: Date, excludeId?: string) {
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        EmployeeId: employeeId,
        Status: { in: OVERLAPPING_STATUSES },
        Id: excludeId ? { not: excludeId } : undefined,
        StartDate: { lte: endDate },
        EndDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new BadRequestException(
        `Cette période chevauche une demande existante (${overlapping.ReferenceCode})`,
      );
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateLeaveRequestDto, requesterEmployeeId: string, canActForOthers: boolean) {
    const employeeId = dto.EmployeeId ?? requesterEmployeeId;
    if (employeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez pas soumettre une demande pour un autre employé");
    }

    const employee = await this.prisma.employee.findUnique({ where: { Id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employé ${employeeId} introuvable`);
    }

    const leaveType = await this.prisma.leaveType.findUnique({ where: { Id: dto.LeaveTypeId } });
    if (!leaveType) {
      throw new NotFoundException(`Type de congé ${dto.LeaveTypeId} introuvable`);
    }

    const startDate = new Date(dto.StartDate);
    const endDate = new Date(dto.EndDate);
    const daysCount = await this.computeWorkingDays(startDate, endDate, employee.OrganizationUnitId);
    if (daysCount <= 0) {
      throw new BadRequestException("La période sélectionnée ne contient aucun jour ouvré");
    }

    const referenceCode = await this.generateReferenceCode();

    return this.prisma.leaveRequest.create({
      data: {
        ReferenceCode: referenceCode,
        EmployeeId: employeeId,
        LeaveTypeId: dto.LeaveTypeId,
        StartDate: startDate,
        EndDate: endDate,
        DaysCount: daysCount,
        Reason: dto.Reason,
        InterimEmployeeId: dto.InterimEmployeeId,
        Status: 'Draft',
        CreatedBy: requesterEmployeeId,
      },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateLeaveRequestDto, requesterEmployeeId: string, canActForOthers: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez modifier que vos propres demandes");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seule une demande en brouillon ou retournée peut être modifiée');
    }

    const leaveTypeId = dto.LeaveTypeId ?? existing.LeaveTypeId;
    const startDate = dto.StartDate ? new Date(dto.StartDate) : existing.StartDate;
    const endDate = dto.EndDate ? new Date(dto.EndDate) : existing.EndDate;

    let daysCount = existing.DaysCount;
    if (dto.StartDate || dto.EndDate) {
      const employee = await this.prisma.employee.findUniqueOrThrow({ where: { Id: existing.EmployeeId } });
      daysCount = await this.computeWorkingDays(startDate, endDate, employee.OrganizationUnitId) as unknown as typeof existing.DaysCount;
    }

    return this.prisma.leaveRequest.update({
      where: { Id: id },
      data: {
        LeaveTypeId: leaveTypeId,
        StartDate: startDate,
        EndDate: endDate,
        DaysCount: daysCount,
        Reason: dto.Reason,
        InterimEmployeeId: dto.InterimEmployeeId,
        ModifiedBy: requesterEmployeeId,
        ModifiedAt: new Date(),
      },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async remove(id: string, requesterEmployeeId: string, canActForOthers: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez supprimer que vos propres demandes");
    }
    if (existing.Status !== 'Draft') {
      throw new BadRequestException('Seule une demande en brouillon peut être supprimée');
    }
    return this.prisma.leaveRequest.delete({ where: { Id: id } });
  }

  private async findOneRaw(id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({ where: { Id: id } });
    if (!leaveRequest) {
      throw new NotFoundException(`Demande de congé ${id} introuvable`);
    }
    return leaveRequest;
  }

  async findOne(id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { Id: id },
      include: {
        employee: { select: { Id: true, FullName: true, EmployeeNumber: true, OrganizationUnitId: true } },
        leaveType: true,
        interimEmployee: { select: { Id: true, FullName: true } },
      },
    });
    if (!leaveRequest) {
      throw new NotFoundException(`Demande de congé ${id} introuvable`);
    }
    const decisions = await this.prisma.approvalDecision.findMany({
      where: { EntityType: 'LeaveRequest', EntityId: id },
      orderBy: { StepOrder: 'asc' },
      include: { validatedByEmployee: { select: { Id: true, FullName: true } } },
    });
    return { ...leaveRequest, decisions };
  }

  findMine(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { EmployeeId: employeeId },
      include: {
        leaveType: true,
        employee: { select: { Id: true, FullName: true, EmployeeNumber: true } },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async findTeam(managerEmployeeId: string) {
    const unitIds = await this.collectManagedUnitIds(managerEmployeeId);
    if (unitIds.length === 0) return [];
    return this.prisma.leaveRequest.findMany({
      where: { employee: { OrganizationUnitId: { in: unitIds } } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, leaveType: true },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  // Unites "geree" par un employe : celles dont il est le Responsable
  // designe, mais aussi celles ou il siege comme validateur d'un pool de
  // conges — un validateur doit garder une visibilite sur les demandes de
  // cette equipe meme une fois qu'elles remontent au-dela de son niveau.
  private async collectManagedUnitIds(managerEmployeeId: string): Promise<string[]> {
    const [managedRoots, validatorPools] = await Promise.all([
      this.prisma.organizationUnit.findMany({
        where: { ManagerId: managerEmployeeId },
        select: { Id: true },
      }),
      this.prisma.approvalPool.findMany({
        where: { ObjectType: 'Leave', members: { some: { EmployeeId: managerEmployeeId } } },
        select: { OrganizationUnitId: true },
      }),
    ]);
    const roots = new Set<string>([
      ...managedRoots.map((unit) => unit.Id),
      ...validatorPools.map((pool) => pool.OrganizationUnitId),
    ]);
    const collected: string[] = [];
    const queue = [...roots];
    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      collected.push(currentId);
      const children = await this.prisma.organizationUnit.findMany({
        where: { ParentId: currentId },
        select: { Id: true },
      });
      queue.push(...children.map((child) => child.Id));
    }
    return collected;
  }

  findAll() {
    return this.prisma.leaveRequest.findMany({
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, leaveType: true },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async findPendingForMe(employeeId: string) {
    const inApproval = await this.prisma.leaveRequest.findMany({
      where: { Status: { in: ['InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'] } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } }, leaveType: true },
      orderBy: { CreatedAt: 'asc' },
    });
    const now = new Date();
    const result: typeof inApproval = [];
    for (const lr of inApproval) {
      const member = await this.prisma.approvalPoolMember.findFirst({
        where: { ApprovalPoolId: lr.ApprovalPoolId as string, StepOrder: lr.CurrentApprovalStep as number },
      });
      if (member && (await this.resolveActualApprover(member, now)) === employeeId) {
        result.push(lr);
      }
    }
    return result;
  }

  // ── Workflow ─────────────────────────────────────────────────────────

  async submit(id: string, requesterEmployeeId: string, canActForOthers: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez soumettre que vos propres demandes");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seule une demande en brouillon ou retournée peut être soumise');
    }

    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { Id: existing.EmployeeId } });
    const leaveType = await this.prisma.leaveType.findUniqueOrThrow({ where: { Id: existing.LeaveTypeId } });

    await this.assertNoOverlap(existing.EmployeeId, existing.StartDate, existing.EndDate, existing.Id);

    if (leaveType.WorkflowType === 'Medical') {
      return this.registerMedicalLeave(existing, leaveType, requesterEmployeeId);
    }
    return this.routeToApproval(existing, employee, leaveType, requesterEmployeeId);
  }

  private async registerMedicalLeave(
    leaveRequest: Awaited<ReturnType<LeaveRequestService['findOneRaw']>>,
    leaveType: { Id: string; DaysPerYear: unknown },
    requesterEmployeeId: string,
  ) {
    const daysPerYear = Number(leaveType.DaysPerYear);
    if (daysPerYear > 0) {
      const balance = await this.leaveTransactionService.getBalance(leaveRequest.EmployeeId, leaveType.Id);
      if (balance < Number(leaveRequest.DaysCount)) {
        throw new BadRequestException(
          `Solde insuffisant (${balance} jour(s) disponible(s) pour ${Number(leaveRequest.DaysCount)} demandé(s))`,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { Id: leaveRequest.Id },
        data: { Status: 'Registered', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
        include: LEAVE_REQUEST_INCLUDE,
      });
      await this.leaveTransactionService.adjustBalance(
        leaveRequest.EmployeeId,
        leaveRequest.LeaveTypeId,
        Number(leaveRequest.DaysCount),
        'Consumption',
        requesterEmployeeId,
        leaveRequest.Id,
        tx,
      );
      return updated;
    });
  }

  private async routeToApproval(
    leaveRequest: Awaited<ReturnType<LeaveRequestService['findOneRaw']>>,
    employee: { OrganizationUnitId: string },
    leaveType: { Id: string; DaysPerYear: unknown; MinNoticeDays: number },
    requesterEmployeeId: string,
  ) {
    const minNoticeDays = leaveType.MinNoticeDays ?? 0;
    if (minNoticeDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((leaveRequest.StartDate.getTime() - today.getTime()) / 86400000);
      if (diffDays < minNoticeDays) {
        throw new BadRequestException(
          `Cette demande nécessite un préavis de ${minNoticeDays} jour(s) — soumise trop tard`,
        );
      }
    }

    const daysPerYear = Number(leaveType.DaysPerYear);
    if (daysPerYear > 0) {
      const balance = await this.leaveTransactionService.getBalance(leaveRequest.EmployeeId, leaveType.Id);
      if (balance < Number(leaveRequest.DaysCount)) {
        throw new BadRequestException(
          `Solde insuffisant (${balance} jour(s) disponible(s) pour ${Number(leaveRequest.DaysCount)} demandé(s))`,
        );
      }
    }

    const pool = await this.approvalPoolService.findApplicablePool(employee.OrganizationUnitId, 'Leave');
    if (!pool) {
      throw new NotFoundException(
        "Aucun pool de validation de congé n'est configuré pour cette unité ou ses parents — contactez le RH",
      );
    }
    const sortedMembers = pool.members.slice().sort((a, b) => a.StepOrder - b.StepOrder);
    if (sortedMembers.length === 0) {
      throw new NotFoundException('Le pool de validation applicable ne contient aucun validateur');
    }

    // Si le demandeur occupe lui-meme un niveau de validateur dans ce pool,
    // ce niveau ET tous les niveaux en dessous sont consideres deja acquis
    // — un validateur senior n'a pas besoin qu'un validateur junior de la
    // meme entite re-valide sa demande. Seuls les niveaux strictement
    // au-dessus de sa propre position restent a valider (findApplicableStep
    // gere en plus le cas, rare, ou le demandeur est aussi l'interimaire
    // resolu d'un de ces niveaux superieurs).
    const requesterOwnLevel = Math.max(
      0,
      ...sortedMembers.filter((m) => m.EmployeeId === requesterEmployeeId).map((m) => m.StepOrder),
    );
    const candidateMembers = sortedMembers.filter((m) => m.StepOrder > requesterOwnLevel);
    const applicable = await this.findApplicableStep(candidateMembers, requesterEmployeeId);
    if (!applicable) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { Id: leaveRequest.Id },
          data: {
            Status: 'Approved', ApprovalPoolId: pool.Id, RejectionReason: null,
            ModifiedBy: requesterEmployeeId, ModifiedAt: new Date(),
          },
          include: LEAVE_REQUEST_INCLUDE,
        });
        await this.leaveTransactionService.adjustBalance(
          leaveRequest.EmployeeId, leaveType.Id, Number(leaveRequest.DaysCount),
          'Consumption', requesterEmployeeId, leaveRequest.Id, tx,
        );
        return updated;
      });
    }

    const { member: firstStep, approverId } = applicable;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { Id: leaveRequest.Id },
        data: {
          Status: `InApprovalN${firstStep.StepOrder}`,
          ApprovalPoolId: pool.Id,
          CurrentApprovalStep: firstStep.StepOrder,
          RejectionReason: null,
          ModifiedBy: requesterEmployeeId,
          ModifiedAt: new Date(),
        },
        include: LEAVE_REQUEST_INCLUDE,
      });
      await tx.approvalDecision.create({
        data: {
          EntityType: 'LeaveRequest',
          EntityId: leaveRequest.Id,
          ApprovalPoolMemberId: firstStep.Id,
          ValidatedByEmployeeId: approverId,
          StepOrder: firstStep.StepOrder,
          Decision: 'Pending',
          CreatedBy: requesterEmployeeId,
        },
      });
      return updated;
    });
  }

  private async assertIsCurrentApprover(
    leaveRequest: Awaited<ReturnType<LeaveRequestService['findOneRaw']>>,
    approverEmployeeId: string,
    canOverride: boolean,
  ) {
    if (canOverride) return;
    if (!leaveRequest.ApprovalPoolId || leaveRequest.CurrentApprovalStep == null) {
      throw new ForbiddenException("Cette demande n'est pas en attente de validation");
    }
    const member = await this.prisma.approvalPoolMember.findFirst({
      where: { ApprovalPoolId: leaveRequest.ApprovalPoolId, StepOrder: leaveRequest.CurrentApprovalStep },
    });
    if (!member || (await this.resolveActualApprover(member, new Date())) !== approverEmployeeId) {
      throw new ForbiddenException("Vous n'êtes pas le validateur actuel de cette demande");
    }
  }

  async approve(id: string, dto: DecideLeaveRequestDto, approverEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);

    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'LeaveRequest',
        EntityId: id,
        StepOrder: existing.CurrentApprovalStep as number,
        Decision: 'Pending',
      },
    });
    if (!pendingDecision) {
      throw new BadRequestException("Aucune décision en attente pour cette étape");
    }

    const pool = await this.prisma.approvalPool.findUniqueOrThrow({
      where: { Id: existing.ApprovalPoolId as string },
      include: { members: true },
    });
    // Le demandeur original (pas l'approbateur courant) est la referance a
    // eviter — si les niveaux restants resolvent tous a lui, la demande
    // passe directement en Approuve plutot que de rester bloquee.
    const remainingMembers = pool.members
      .filter((m) => m.StepOrder > (existing.CurrentApprovalStep as number))
      .sort((a, b) => a.StepOrder - b.StepOrder);
    const applicable = await this.findApplicableStep(remainingMembers, existing.EmployeeId);

    return this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.update({
        where: { Id: pendingDecision.Id },
        data: {
          Decision: 'Approved',
          Comment: dto.Comment,
          DecidedAt: new Date(),
          ValidatedByEmployeeId: approverEmployeeId,
        },
      });

      if (applicable) {
        const { member: nextStep, approverId } = applicable;
        const updated = await tx.leaveRequest.update({
          where: { Id: id },
          data: { Status: `InApprovalN${nextStep.StepOrder}`, CurrentApprovalStep: nextStep.StepOrder },
          include: LEAVE_REQUEST_INCLUDE,
        });
        await tx.approvalDecision.create({
          data: {
            EntityType: 'LeaveRequest',
            EntityId: id,
            ApprovalPoolMemberId: nextStep.Id,
            ValidatedByEmployeeId: approverId,
            StepOrder: nextStep.StepOrder,
            Decision: 'Pending',
            CreatedBy: approverEmployeeId,
          },
        });
        return updated;
      }

      const updated = await tx.leaveRequest.update({
        where: { Id: id },
        data: { Status: 'Approved' },
        include: LEAVE_REQUEST_INCLUDE,
      });
      await this.leaveTransactionService.adjustBalance(
        existing.EmployeeId,
        existing.LeaveTypeId,
        Number(existing.DaysCount),
        'Consumption',
        approverEmployeeId,
        existing.Id,
        tx,
      );
      return updated;
    });
  }

  async reject(id: string, dto: DecideLeaveRequestDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le motif du refus doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Rejected', dto.Comment, approverEmployeeId);
  }

  async return_(id: string, dto: DecideLeaveRequestDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le commentaire doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Returned', dto.Comment, approverEmployeeId);
  }

  private async closeApprovalStep(
    existing: Awaited<ReturnType<LeaveRequestService['findOneRaw']>>,
    decision: 'Rejected' | 'Returned',
    comment: string,
    approverEmployeeId: string,
  ) {
    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'LeaveRequest',
        EntityId: existing.Id,
        StepOrder: existing.CurrentApprovalStep as number,
        Decision: 'Pending',
      },
    });

    return this.prisma.$transaction(async (tx) => {
      if (pendingDecision) {
        await tx.approvalDecision.update({
          where: { Id: pendingDecision.Id },
          data: { Decision: decision, Comment: comment, DecidedAt: new Date(), ValidatedByEmployeeId: approverEmployeeId },
        });
      }
      return tx.leaveRequest.update({
        where: { Id: existing.Id },
        data: { Status: decision, RejectionReason: comment },
        include: LEAVE_REQUEST_INCLUDE,
      });
    });
  }

  async cancel(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    const isSelf = existing.EmployeeId === requesterEmployeeId;
    if (!isSelf && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez annuler que vos propres demandes");
    }
    // Une fois approuvee (ou enregistree directement, cas conge medical), le
    // demandeur ne peut plus annuler lui-meme sa propre demande — seule une
    // action administrative (canOverride, sur la demande d'un tiers) le peut
    // encore, par ex. pour corriger une erreur.
    const SELF_CANCELLABLE = ['Draft', 'Pending', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'];
    const cancellable = isSelf ? SELF_CANCELLABLE : [...SELF_CANCELLABLE, 'Approved', 'Registered'];
    if (!cancellable.includes(existing.Status)) {
      throw new BadRequestException(`Une demande au statut "${existing.Status}" ne peut plus être annulée`);
    }

    const balanceWasDebited = existing.Status === 'Approved' || existing.Status === 'Registered';

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { Id: id },
        data: { Status: 'Cancelled', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
        include: LEAVE_REQUEST_INCLUDE,
      });
      if (balanceWasDebited) {
        await this.leaveTransactionService.adjustBalance(
          existing.EmployeeId,
          existing.LeaveTypeId,
          Number(existing.DaysCount),
          'Acquisition',
          requesterEmployeeId,
          existing.Id,
          tx,
        );
      }
      return updated;
    });
  }

  async markDone(id: string, requesterEmployeeId: string) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId) {
      throw new ForbiddenException("Vous ne pouvez mettre à jour que vos propres demandes");
    }
    if (existing.Status !== 'Registered') {
      throw new BadRequestException('Seule une demande enregistrée peut être marquée comme effectuée');
    }
    return this.prisma.leaveRequest.update({
      where: { Id: id },
      data: { Status: 'Done', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }

  async regularize(id: string, requesterEmployeeId: string) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId) {
      throw new ForbiddenException("Vous ne pouvez mettre à jour que vos propres demandes");
    }
    if (existing.Status !== 'Done') {
      throw new BadRequestException('Seule une demande effectuée peut être régularisée');
    }
    return this.prisma.leaveRequest.update({
      where: { Id: id },
      data: { Status: 'Regularized', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
      include: LEAVE_REQUEST_INCLUDE,
    });
  }
}
