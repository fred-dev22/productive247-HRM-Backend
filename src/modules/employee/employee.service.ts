import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  // Assigning an employee to a Position occupies it; the reverse (freeing a
  // Position) happens on update/remove below whenever the assignment changes.
  create(dto: CreateEmployeeDto, createdBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: { ...dto, FullName: `${dto.FirstName} ${dto.LastName}`, CreatedBy: createdBy },
      });

      if (dto.PositionId) {
        await tx.position.update({
          where: { Id: dto.PositionId },
          data: { OccupationStatus: 'Occupied' },
        });
      }

      return employee;
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
      const employee = await tx.employee.update({
        where: { Id: id },
        data: {
          ...dto,
          FullName: `${FirstName} ${LastName}`,
          ModifiedBy: modifiedBy,
          ModifiedAt: new Date(),
        },
      });

      if (positionChanged) {
        if (oldPositionId) {
          await tx.position.update({ where: { Id: oldPositionId }, data: { OccupationStatus: 'Vacant' } });
        }
        if (newPositionId) {
          await tx.position.update({ where: { Id: newPositionId }, data: { OccupationStatus: 'Occupied' } });
        }
      }

      return employee;
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      if (existing.PositionId) {
        await tx.position.update({
          where: { Id: existing.PositionId },
          data: { OccupationStatus: 'Vacant' },
        });
      }
      return tx.employee.delete({ where: { Id: id } });
    });
  }
}
