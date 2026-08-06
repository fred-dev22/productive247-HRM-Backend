import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationUnitDto } from './dto/create-organization-unit.dto';
import { UpdateOrganizationUnitDto } from './dto/update-organization-unit.dto';
import { bulkImport } from '../../common/utils/bulk-import.util';

@Injectable()
export class OrganizationUnitService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateOrganizationUnitDto, createdBy: string) {
    return this.prisma.organizationUnit.create({ data: { ...dto, CreatedBy: createdBy } });
  }

  // Import CSV (Lot D) — voir common/utils/bulk-import.util.ts. L'entite
  // parente (ParentId) doit deja exister : pas de tri topologique ici, le
  // frontend ne resout que par rapport aux entites deja chargees avant
  // l'ouverture de l'import (voir message de dependance affiche a l'etape 1).
  bulkCreate(items: unknown[], createdBy: string) {
    return bulkImport(items, CreateOrganizationUnitDto, (dto) => this.create(dto, createdBy));
  }

  findAll() {
    return this.prisma.organizationUnit.findMany();
  }

  async findTree() {
    const units = await this.prisma.organizationUnit.findMany();
    const byParent = new Map<string | null, typeof units>();
    for (const unit of units) {
      const key = unit.ParentId;
      const bucket = byParent.get(key);
      if (bucket) bucket.push(unit);
      else byParent.set(key, [unit]);
    }

    const buildNode = (unit: (typeof units)[number]) => ({
      ...unit,
      children: (byParent.get(unit.Id) ?? []).map(buildNode),
    });

    return (byParent.get(null) ?? []).map(buildNode);
  }

  findChildren(id: string) {
    return this.prisma.organizationUnit.findMany({ where: { ParentId: id } });
  }

  async findOne(id: string) {
    const unit = await this.prisma.organizationUnit.findUnique({ where: { Id: id } });
    if (!unit) {
      throw new NotFoundException(`Unité organisationnelle ${id} introuvable`);
    }
    return unit;
  }

  async update(id: string, dto: UpdateOrganizationUnitDto, modifiedBy: string) {
    await this.findOne(id);
    return this.prisma.organizationUnit.update({
      where: { Id: id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.organizationUnit.delete({ where: { Id: id } });
  }

  async submit(id: string, modifiedBy: string) {
    const unit = await this.findOne(id);
    if (unit.Status !== 'Draft') {
      throw new ConflictException(
        'Seule une unité en brouillon peut être soumise pour approbation',
      );
    }
    return this.prisma.organizationUnit.update({
      where: { Id: id },
      data: { Status: 'PendingApproval', ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async approve(id: string, modifiedBy: string) {
    const unit = await this.findOne(id);
    if (unit.Status !== 'PendingApproval') {
      throw new ConflictException(
        "Seule une unité en attente d'approbation peut être approuvée",
      );
    }
    return this.prisma.organizationUnit.update({
      where: { Id: id },
      data: { Status: 'Active', ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }

  async reject(id: string, modifiedBy: string) {
    const unit = await this.findOne(id);
    if (unit.Status !== 'PendingApproval') {
      throw new ConflictException(
        "Seule une unité en attente d'approbation peut être rejetée",
      );
    }
    return this.prisma.organizationUnit.update({
      where: { Id: id },
      data: { Status: 'Draft', ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }
}
