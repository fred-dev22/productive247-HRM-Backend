import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type TxClient = Prisma.TransactionClient | PrismaService;

const SYSTEM_ACTOR_LABEL = 'Génération automatique des acquisitions';

@Injectable()
export class LeaveTransactionService {
  private readonly logger = new Logger(LeaveTransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(employeeId?: string) {
    return this.prisma.leaveTransaction.findMany({
      where: employeeId ? { EmployeeId: employeeId } : undefined,
      include: { leaveType: { select: { Id: true, Name: true, Code: true, Color: true } } },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  // Solde par type de conge pour un employe — lu directement depuis
  // EmployeeLeaveBalance (cache maintenu a jour par creditBalance/debitBalance
  // ci-dessous), pas recalcule a partir du ledger a chaque appel.
  async getBalances(employeeId: string) {
    const [balances, leaveTypes] = await Promise.all([
      this.prisma.employeeLeaveBalance.findMany({ where: { EmployeeId: employeeId } }),
      this.prisma.leaveType.findMany({ where: { IsActive: true } }),
    ]);

    return leaveTypes.map((lt) => ({
      leaveTypeId: lt.Id,
      leaveTypeName: lt.Name,
      leaveTypeCode: lt.Code,
      color: lt.Color,
      daysPerYear: Number(lt.DaysPerYear),
      balance: Number(balances.find((b) => b.LeaveTypeId === lt.Id)?.Balance ?? 0),
    }));
  }

  // Vue RH : solde de tous les employes actifs, tous types confondus — pour
  // le tableau recapitulatif (LeaveBalancesView.vue).
  async getAllBalances() {
    const [employees, balances, leaveTypes] = await Promise.all([
      this.prisma.employee.findMany({
        where: { Status: { in: ['Active', 'OnTrial'] } },
        select: { Id: true, FullName: true, organizationUnit: { select: { Name: true } } },
      }),
      this.prisma.employeeLeaveBalance.findMany(),
      this.prisma.leaveType.findMany({ where: { IsActive: true } }),
    ]);

    return employees.map((employee) => ({
      employeeId: employee.Id,
      employeeName: employee.FullName,
      entityName: employee.organizationUnit?.Name ?? '',
      balances: leaveTypes.map((lt) => ({
        leaveTypeId: lt.Id,
        leaveTypeName: lt.Name,
        leaveTypeCode: lt.Code,
        color: lt.Color,
        daysPerYear: Number(lt.DaysPerYear),
        balance: Number(
          balances.find((b) => b.EmployeeId === employee.Id && b.LeaveTypeId === lt.Id)?.Balance ?? 0,
        ),
      })),
    }));
  }

  // Credite (ou debite si amount < 0) le solde en cache d'un employe pour un
  // type de conge donne, et trace le mouvement dans LeaveTransaction pour
  // l'audit. Utilise par generateAccruals ci-dessous ET par
  // LeaveRequestService (consommation a l'approbation, reversement a
  // l'annulation) — c'est le point d'entree unique qui garde les deux en
  // phase.
  async adjustBalance(
    employeeId: string,
    leaveTypeId: string,
    amount: number,
    type: 'Acquisition' | 'Consumption',
    actorId: string,
    leaveRequestId?: string,
    client: TxClient = this.prisma,
  ) {
    const now = new Date();
    await client.employeeLeaveBalance.upsert({
      where: { EmployeeId_LeaveTypeId: { EmployeeId: employeeId, LeaveTypeId: leaveTypeId } },
      create: {
        EmployeeId: employeeId,
        LeaveTypeId: leaveTypeId,
        Balance: type === 'Acquisition' ? amount : -amount,
      },
      update: {
        Balance: { increment: type === 'Acquisition' ? amount : -amount },
        ModifiedAt: now,
      },
    });
    await client.leaveTransaction.create({
      data: {
        EmployeeId: employeeId,
        LeaveTypeId: leaveTypeId,
        Type: type,
        Days: amount,
        StartDate: now,
        EndDate: now,
        LeaveRequestId: leaveRequestId,
        CreatedBy: actorId,
      },
    });
  }

  async getBalance(employeeId: string, leaveTypeId: string, client: TxClient = this.prisma): Promise<number> {
    const row = await client.employeeLeaveBalance.findUnique({
      where: { EmployeeId_LeaveTypeId: { EmployeeId: employeeId, LeaveTypeId: leaveTypeId } },
    });
    return Number(row?.Balance ?? 0);
  }

  // Genere les credits d'acquisition pour tous les employes actifs :
  // - types a accumulation mensuelle -> credite DaysPerMonth a chaque appel
  // - types a dotation annuelle (MonthlyAccrual=false) -> credite DaysPerYear
  //   une seule fois par an (uniquement si aucune Acquisition n'existe deja
  //   pour ce type sur l'annee en cours)
  // Idempotence best-effort : le worker appelant (cron ou déclenchement
  // manuel) est responsable de ne pas relancer deux fois le même mois — voir
  // AccrualSchedulerService.LastLeaveAccrualRunAt.
  async generateAccruals(triggeredBy: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStart = new Date(Date.UTC(currentYear, 0, 1));

    const [employees, leaveTypes] = await Promise.all([
      this.prisma.employee.findMany({ where: { Status: { in: ['Active', 'OnTrial'] } }, select: { Id: true } }),
      this.prisma.leaveType.findMany({ where: { IsActive: true } }),
    ]);

    let created = 0;
    for (const leaveType of leaveTypes) {
      const daysPerYear = Number(leaveType.DaysPerYear);
      if (daysPerYear <= 0) continue;

      if (leaveType.MonthlyAccrual) {
        const amount = leaveType.DaysPerMonth != null ? Number(leaveType.DaysPerMonth) : daysPerYear / 12;
        for (const employee of employees) {
          await this.adjustBalance(employee.Id, leaveType.Id, amount, 'Acquisition', triggeredBy);
          created++;
        }
      } else {
        for (const employee of employees) {
          const alreadyGranted = await this.prisma.leaveTransaction.findFirst({
            where: {
              EmployeeId: employee.Id,
              LeaveTypeId: leaveType.Id,
              Type: 'Acquisition',
              CreatedAt: { gte: yearStart },
              LeaveRequestId: null,
            },
          });
          if (alreadyGranted) continue;
          await this.adjustBalance(employee.Id, leaveType.Id, daysPerYear, 'Acquisition', triggeredBy);
          created++;
        }
      }
    }

    await this.prisma.companySettings.updateMany({ data: { LastLeaveAccrualRunAt: now } });
    this.logger.log(`${SYSTEM_ACTOR_LABEL} : ${created} crédit(s) appliqué(s)`);
    return { created, runAt: now };
  }
}
