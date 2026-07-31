import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalPoolService } from '../approval-pool/approval-pool.service';
import { CreateMissionOrderDto } from './dto/create-mission-order.dto';
import { UpdateMissionOrderDto } from './dto/update-mission-order.dto';
import { DecideMissionOrderDto } from './dto/decide-mission-order.dto';

const EDITABLE_STATUSES = ['Draft', 'Returned'];
const CANCELLABLE_STATUSES = ['Draft', 'InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4', 'Approved'];
const DEFAULT_CURRENCY = 'MGA';

export interface AllowanceLine {
  expenseTypeId: string;
  expenseTypeName: string;
  unit: string;
  rate: number;
  days: number;
  amount: number;
  currency: string;
  documentRequired: boolean;
}

@Injectable()
export class MissionOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalPoolService: ApprovalPoolService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────

  private async generateReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OM-${year}-`;
    const count = await this.prisma.missionOrder.count({
      where: { ReferenceCode: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  // DepartureDate/ReturnDate sont des dates pures (sans heure) — duree
  // inclusive : depart et retour le meme jour = 1 jour.
  private computeDays(departureDate: Date, returnDate: Date): number {
    if (returnDate < departureDate) {
      throw new BadRequestException('La date de retour doit être postérieure ou égale à la date de départ');
    }
    const diffDays = Math.round((returnDate.getTime() - departureDate.getTime()) / 86400000);
    return diffDays + 1;
  }

  // Calcule l'estimation du per diem a partir de la matrice ExpenseConfig —
  // aucun montant n'est stocke sur MissionOrder, tout est recalcule a la
  // volee (voir doc-comment du modele dans schema.prisma).
  private async computeAllowanceEstimate(
    employeeCategoryId: string | null,
    missionCategory: string,
    days: number,
  ): Promise<{ lines: AllowanceLine[]; total: number }> {
    if (!employeeCategoryId) {
      return { lines: [], total: 0 };
    }
    const configs = await this.prisma.expenseConfig.findMany({
      where: { EmployeeCategoryId: employeeCategoryId, MissionCategory: missionCategory, IsActive: true },
      include: { expenseType: true },
    });
    const lines: AllowanceLine[] = configs.map((c) => {
      const rate = Number(c.DailyRate);
      const amount = c.expenseType.Unit === 'PerDay' ? rate * days : c.expenseType.Unit === 'PerTrip' ? rate : 0;
      return {
        expenseTypeId: c.ExpenseTypeId,
        expenseTypeName: c.expenseType.Name,
        unit: c.expenseType.Unit,
        rate,
        days,
        amount,
        currency: c.Currency,
        documentRequired: c.DocumentRequired,
      };
    });
    return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
  }

  // Attache un total estime a chaque mission d'une liste, en groupant les
  // requetes ExpenseConfig/Employee (2 requetes au total, pas de N+1).
  private async attachEstimatedTotals<T extends { EmployeeId: string; MissionCategory: string; DaysCount: unknown }>(
    missions: T[],
  ): Promise<(T & { EstimatedTotal: number })[]> {
    if (missions.length === 0) return [];
    const employeeIds = [...new Set(missions.map((m) => m.EmployeeId))];
    const employees = await this.prisma.employee.findMany({
      where: { Id: { in: employeeIds } },
      select: { Id: true, EmployeeCategoryId: true },
    });
    const categoryByEmployee = new Map(employees.map((e) => [e.Id, e.EmployeeCategoryId]));

    const categoryIds = [...new Set(employees.map((e) => e.EmployeeCategoryId).filter((id): id is string => !!id))];
    const configs = categoryIds.length
      ? await this.prisma.expenseConfig.findMany({
          where: { EmployeeCategoryId: { in: categoryIds }, IsActive: true },
          include: { expenseType: true },
        })
      : [];

    return missions.map((m) => {
      const categoryId = categoryByEmployee.get(m.EmployeeId) ?? null;
      const days = Number(m.DaysCount);
      const total = configs
        .filter((c) => c.EmployeeCategoryId === categoryId && c.MissionCategory === m.MissionCategory)
        .reduce((s, c) => {
          const rate = Number(c.DailyRate);
          const amount = c.expenseType.Unit === 'PerDay' ? rate * days : c.expenseType.Unit === 'PerTrip' ? rate : 0;
          return s + amount;
        }, 0);
      return { ...m, EstimatedTotal: total };
    });
  }

  private async findOneRaw(id: string) {
    const missionOrder = await this.prisma.missionOrder.findUnique({ where: { Id: id } });
    if (!missionOrder) {
      throw new NotFoundException(`Ordre de mission ${id} introuvable`);
    }
    return missionOrder;
  }

  private resolveActualApprover(
    member: { EmployeeId: string; InterimEmployeeId: string | null; InterimStartDate: Date | null; InterimEndDate: Date | null },
    at: Date,
  ): string {
    if (
      member.InterimEmployeeId &&
      member.InterimStartDate &&
      member.InterimEndDate &&
      at >= member.InterimStartDate &&
      at <= member.InterimEndDate
    ) {
      return member.InterimEmployeeId;
    }
    return member.EmployeeId;
  }

  // ── Estimation (calculette live du formulaire de creation) ───────────

  async estimate(employeeId: string, missionCategory: string, departureDate: string, returnDate: string) {
    const employee = await this.prisma.employee.findUnique({ where: { Id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employé ${employeeId} introuvable`);
    }
    const days = this.computeDays(new Date(departureDate), new Date(returnDate));
    const result = await this.computeAllowanceEstimate(employee.EmployeeCategoryId, missionCategory, days);
    return { days, ...result };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateMissionOrderDto, requesterEmployeeId: string, canActForOthers: boolean) {
    const employeeId = dto.EmployeeId ?? requesterEmployeeId;
    if (employeeId !== requesterEmployeeId && !canActForOthers) {
      throw new ForbiddenException("Vous ne pouvez pas créer un ordre de mission pour un autre employé");
    }

    const employee = await this.prisma.employee.findUnique({ where: { Id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employé ${employeeId} introuvable`);
    }
    if (!employee.EmployeeCategoryId) {
      throw new BadRequestException(
        "Cet employé n'a pas de catégorie de frais assignée — contactez le RH avant de créer un ordre de mission",
      );
    }

    const departureDate = new Date(dto.DepartureDate);
    const returnDate = new Date(dto.ReturnDate);
    const daysCount = this.computeDays(departureDate, returnDate);
    const referenceCode = await this.generateReferenceCode();

    return this.prisma.missionOrder.create({
      data: {
        ReferenceCode: referenceCode,
        EmployeeId: employeeId,
        Destination: dto.Destination,
        MissionCategory: dto.MissionCategory,
        Purpose: dto.Purpose,
        DepartureDate: departureDate,
        ReturnDate: returnDate,
        DaysCount: daysCount,
        TransportModeGo: dto.TransportModeGo,
        TransportModeReturn: dto.TransportModeReturn,
        AdvanceRequested: dto.AdvanceRequested ?? 0,
        Currency: dto.Currency ?? DEFAULT_CURRENCY,
        Status: 'Draft',
        CreatedBy: requesterEmployeeId,
      },
    });
  }

  async update(id: string, dto: UpdateMissionOrderDto, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez modifier que vos propres ordres de mission");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seul un ordre en brouillon ou retourné peut être modifié');
    }

    const departureDate = dto.DepartureDate ? new Date(dto.DepartureDate) : existing.DepartureDate;
    const returnDate = dto.ReturnDate ? new Date(dto.ReturnDate) : existing.ReturnDate;
    const daysCount = dto.DepartureDate || dto.ReturnDate ? this.computeDays(departureDate, returnDate) : existing.DaysCount;

    return this.prisma.missionOrder.update({
      where: { Id: id },
      data: {
        Destination: dto.Destination ?? existing.Destination,
        MissionCategory: dto.MissionCategory ?? existing.MissionCategory,
        Purpose: dto.Purpose ?? existing.Purpose,
        DepartureDate: departureDate,
        ReturnDate: returnDate,
        DaysCount: daysCount,
        TransportModeGo: dto.TransportModeGo ?? existing.TransportModeGo,
        TransportModeReturn: dto.TransportModeReturn ?? existing.TransportModeReturn,
        AdvanceRequested: dto.AdvanceRequested ?? existing.AdvanceRequested,
        Currency: dto.Currency ?? existing.Currency,
        ModifiedBy: requesterEmployeeId,
        ModifiedAt: new Date(),
      },
    });
  }

  async remove(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez supprimer que vos propres ordres de mission");
    }
    if (existing.Status !== 'Draft') {
      throw new BadRequestException('Seul un ordre en brouillon peut être supprimé');
    }
    return this.prisma.missionOrder.delete({ where: { Id: id } });
  }

  async findOne(id: string) {
    const missionOrder = await this.prisma.missionOrder.findUnique({
      where: { Id: id },
      include: {
        employee: { select: { Id: true, FullName: true, EmployeeNumber: true, EmployeeCategoryId: true } },
      },
    });
    if (!missionOrder) {
      throw new NotFoundException(`Ordre de mission ${id} introuvable`);
    }
    const decisions = await this.prisma.approvalDecision.findMany({
      where: { EntityType: 'MissionOrder', EntityId: id },
      orderBy: { StepOrder: 'asc' },
      include: { validatedByEmployee: { select: { Id: true, FullName: true } } },
    });
    const allowance = await this.computeAllowanceEstimate(
      missionOrder.employee.EmployeeCategoryId,
      missionOrder.MissionCategory,
      Number(missionOrder.DaysCount),
    );
    return { ...missionOrder, decisions, allowance };
  }

  async findMine(employeeId: string) {
    const missions = await this.prisma.missionOrder.findMany({
      where: { EmployeeId: employeeId },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachEstimatedTotals(missions);
  }

  async findTeam(managerEmployeeId: string) {
    const unitIds = await this.collectManagedUnitIds(managerEmployeeId);
    if (unitIds.length === 0) return [];
    const missions = await this.prisma.missionOrder.findMany({
      where: { employee: { OrganizationUnitId: { in: unitIds } } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachEstimatedTotals(missions);
  }

  private async collectManagedUnitIds(managerEmployeeId: string): Promise<string[]> {
    const managedRoots = await this.prisma.organizationUnit.findMany({
      where: { ManagerId: managerEmployeeId },
      select: { Id: true },
    });
    const collected: string[] = [];
    const queue = managedRoots.map((unit) => unit.Id);
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

  async findAll() {
    const missions = await this.prisma.missionOrder.findMany({
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
    return this.attachEstimatedTotals(missions);
  }

  async findPendingForMe(employeeId: string) {
    const inApproval = await this.prisma.missionOrder.findMany({
      where: { Status: { in: ['InApprovalN1', 'InApprovalN2', 'InApprovalN3', 'InApprovalN4'] } },
      include: { employee: { select: { Id: true, FullName: true, EmployeeNumber: true } } },
      orderBy: { CreatedAt: 'asc' },
    });
    const now = new Date();
    const result: typeof inApproval = [];
    for (const mo of inApproval) {
      const member = await this.prisma.approvalPoolMember.findFirst({
        where: { ApprovalPoolId: mo.ApprovalPoolId as string, StepOrder: mo.CurrentApprovalStep as number },
      });
      if (member && this.resolveActualApprover(member, now) === employeeId) {
        result.push(mo);
      }
    }
    return this.attachEstimatedTotals(result);
  }

  // ── Workflow ─────────────────────────────────────────────────────────

  async submit(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez soumettre que vos propres ordres de mission");
    }
    if (!EDITABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException('Seul un ordre en brouillon ou retourné peut être soumis');
    }

    const employee = await this.prisma.employee.findUniqueOrThrow({ where: { Id: existing.EmployeeId } });
    const pool = await this.approvalPoolService.findApplicablePool(employee.OrganizationUnitId, 'Mission');
    if (!pool) {
      throw new NotFoundException(
        "Aucun pool de validation de mission n'est configuré pour cette unité ou ses parents — contactez le RH",
      );
    }
    const firstStep = pool.members.slice().sort((a, b) => a.StepOrder - b.StepOrder)[0];
    if (!firstStep) {
      throw new NotFoundException('Le pool de validation applicable ne contient aucun validateur');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.missionOrder.update({
        where: { Id: id },
        data: {
          Status: `InApprovalN${firstStep.StepOrder}`,
          ApprovalPoolId: pool.Id,
          CurrentApprovalStep: firstStep.StepOrder,
          RejectionReason: null,
          ModifiedBy: requesterEmployeeId,
          ModifiedAt: new Date(),
        },
      });
      await tx.approvalDecision.create({
        data: {
          EntityType: 'MissionOrder',
          EntityId: id,
          ApprovalPoolMemberId: firstStep.Id,
          ValidatedByEmployeeId: this.resolveActualApprover(firstStep, new Date()),
          StepOrder: firstStep.StepOrder,
          Decision: 'Pending',
          CreatedBy: requesterEmployeeId,
        },
      });
      return updated;
    });
  }

  private async assertIsCurrentApprover(
    missionOrder: Awaited<ReturnType<MissionOrderService['findOneRaw']>>,
    approverEmployeeId: string,
    canOverride: boolean,
  ) {
    if (canOverride) return;
    if (!missionOrder.ApprovalPoolId || missionOrder.CurrentApprovalStep == null) {
      throw new ForbiddenException("Cet ordre n'est pas en attente de validation");
    }
    const member = await this.prisma.approvalPoolMember.findFirst({
      where: { ApprovalPoolId: missionOrder.ApprovalPoolId, StepOrder: missionOrder.CurrentApprovalStep },
    });
    if (!member || this.resolveActualApprover(member, new Date()) !== approverEmployeeId) {
      throw new ForbiddenException("Vous n'êtes pas le validateur actuel de cet ordre de mission");
    }
  }

  async approve(id: string, dto: DecideMissionOrderDto, approverEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);

    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'MissionOrder',
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
    const nextStep = pool.members
      .filter((m) => m.StepOrder > (existing.CurrentApprovalStep as number))
      .sort((a, b) => a.StepOrder - b.StepOrder)[0];

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

      if (nextStep) {
        const updated = await tx.missionOrder.update({
          where: { Id: id },
          data: { Status: `InApprovalN${nextStep.StepOrder}`, CurrentApprovalStep: nextStep.StepOrder },
        });
        await tx.approvalDecision.create({
          data: {
            EntityType: 'MissionOrder',
            EntityId: id,
            ApprovalPoolMemberId: nextStep.Id,
            ValidatedByEmployeeId: this.resolveActualApprover(nextStep, new Date()),
            StepOrder: nextStep.StepOrder,
            Decision: 'Pending',
            CreatedBy: approverEmployeeId,
          },
        });
        return updated;
      }

      return tx.missionOrder.update({ where: { Id: id }, data: { Status: 'Approved' } });
    });
  }

  async reject(id: string, dto: DecideMissionOrderDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le motif du refus doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Rejected', dto.Comment, approverEmployeeId);
  }

  async return_(id: string, dto: DecideMissionOrderDto, approverEmployeeId: string, canOverride: boolean) {
    if (!dto.Comment || dto.Comment.trim().length < 10) {
      throw new BadRequestException('Le commentaire doit comporter au moins 10 caractères');
    }
    const existing = await this.findOneRaw(id);
    await this.assertIsCurrentApprover(existing, approverEmployeeId, canOverride);
    return this.closeApprovalStep(existing, 'Returned', dto.Comment, approverEmployeeId);
  }

  private async closeApprovalStep(
    existing: Awaited<ReturnType<MissionOrderService['findOneRaw']>>,
    decision: 'Rejected' | 'Returned',
    comment: string,
    approverEmployeeId: string,
  ) {
    const pendingDecision = await this.prisma.approvalDecision.findFirst({
      where: {
        EntityType: 'MissionOrder',
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
      return tx.missionOrder.update({
        where: { Id: existing.Id },
        data: { Status: decision, RejectionReason: comment },
      });
    });
  }

  async cancel(id: string, requesterEmployeeId: string, canOverride: boolean) {
    const existing = await this.findOneRaw(id);
    if (existing.EmployeeId !== requesterEmployeeId && !canOverride) {
      throw new ForbiddenException("Vous ne pouvez annuler que vos propres ordres de mission");
    }
    if (!CANCELLABLE_STATUSES.includes(existing.Status)) {
      throw new BadRequestException(`Un ordre au statut "${existing.Status}" ne peut plus être annulé`);
    }
    return this.prisma.missionOrder.update({
      where: { Id: id },
      data: { Status: 'Cancelled', ModifiedBy: requesterEmployeeId, ModifiedAt: new Date() },
    });
  }
}
