import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

type TxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  // Matricule genere cote serveur (compte les EmployeeNumber "EMP..." existants,
  // en ignorant les autres prefixes eventuels comme les comptes de seed) —
  // evite les collisions du generateur cote frontend (qui se basait sur la
  // liste d'employes deja chargee en memoire, potentiellement incomplete).
  // Reste une suggestion : le champ est pre-rempli mais modifiable, la
  // contrainte @unique + le filtre Prisma font foi en dernier recours.
  async generateEmployeeNumber(): Promise<string> {
    const count = await this.prisma.employee.count({
      where: { EmployeeNumber: { startsWith: 'EMP' } },
    });
    return `EMP${String(count + 1).padStart(3, '0')}`;
  }

  // L'occupation d'un poste (Vacant/Occupé) n'est plus stockee — un poste a
  // desormais une Capacity (N sieges), recomptee ici a chaque affectation
  // pour empecher de depasser le nombre de places disponibles (voir decision
  // du 30/07). Le frontend filtre deja les postes complets de la liste, ceci
  // est le filet de securite cote serveur.
  private async assertPositionHasCapacity(tx: TxClient, positionId: string) {
    const position = await tx.position.findUnique({
      where: { Id: positionId },
      include: { _count: { select: { employees: true } } },
    });
    if (!position) {
      throw new NotFoundException(`Poste ${positionId} introuvable`);
    }
    if (position._count.employees >= position.Capacity) {
      throw new BadRequestException(`Le poste « ${position.Title} » n'a plus de siège disponible`);
    }
  }

  async create(dto: CreateEmployeeDto, createdBy: string) {
    const employeeNumber = dto.EmployeeNumber?.trim() || (await this.generateEmployeeNumber());
    return this.prisma.$transaction(async (tx) => {
      if (dto.PositionId) {
        await this.assertPositionHasCapacity(tx, dto.PositionId);
      }
      return tx.employee.create({
        data: { ...dto, EmployeeNumber: employeeNumber, FullName: `${dto.FirstName} ${dto.LastName}`, CreatedBy: createdBy },
      });
    });
  }

  findAll() {
    return this.prisma.employee.findMany();
  }

  // "Son équipe" = les employés des unités organisationnelles que le
  // demandeur dirige (OrganizationUnit.ManagerId), y compris les sous-unités.
  async findTeam(managerEmployeeId: string) {
    const unitIds = await this.collectManagedUnitIds(managerEmployeeId);
    if (unitIds.length === 0) {
      return [];
    }
    return this.prisma.employee.findMany({
      where: { OrganizationUnitId: { in: unitIds } },
    });
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

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { Id: id } });
    if (!employee) {
      throw new NotFoundException(`Employé ${id} introuvable`);
    }
    return employee;
  }

  // Pas de permission dédiée pour consulter UNE fiche : tout utilisateur
  // connecté voit son propre dossier sans permission explicite ; au-delà,
  // il faut EMPLOYE_VOIR_TOUT (tous) ou EMPLOYE_VOIR_EQUIPE (dossier dans
  // son périmètre managérial).
  async findOneForRequester(id: string, requesterEmployeeId: string, permissions: Set<string>) {
    const employee = await this.findOne(id);

    if (id === requesterEmployeeId) {
      return employee;
    }
    if (permissions.has('EMPLOYE_VOIR_TOUT')) {
      return employee;
    }
    if (permissions.has('EMPLOYE_VOIR_EQUIPE')) {
      const managedUnitIds = await this.collectManagedUnitIds(requesterEmployeeId);
      if (managedUnitIds.includes(employee.OrganizationUnitId)) {
        return employee;
      }
    }

    throw new ForbiddenException("Vous n'avez pas la permission de consulter ce dossier employé");
  }

  async update(id: string, dto: UpdateEmployeeDto, modifiedBy: string) {
    const existing = await this.findOne(id);
    const FirstName = dto.FirstName ?? existing.FirstName;
    const LastName = dto.LastName ?? existing.LastName;

    // 'PositionId' in dto distinguishes "field omitted from the PATCH body"
    // (no change intended) from "field explicitly sent" (including null,
    // which means the employee is being unassigned from their position).
    const positionFieldSent = 'PositionId' in dto;
    const oldPositionId = existing.PositionId;
    const newPositionId = dto.PositionId;
    const positionChanged = positionFieldSent && newPositionId !== oldPositionId;

    return this.prisma.$transaction(async (tx) => {
      if (positionChanged && newPositionId) {
        await this.assertPositionHasCapacity(tx, newPositionId);
      }
      return tx.employee.update({
        where: { Id: id },
        data: {
          ...dto,
          FullName: `${FirstName} ${LastName}`,
          ModifiedBy: modifiedBy,
          ModifiedAt: new Date(),
        },
      });
    });
  }

  // Soft delete : l'employé reste en base (Status=Inactive) — un hard delete
  // casserait les références historiques (congés, missions, notes de frais
  // passées) qui pointent vers cet Id.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { Id: id },
      data: { Status: 'Inactive', PositionId: null, ModifiedAt: new Date() },
    });
  }
}
