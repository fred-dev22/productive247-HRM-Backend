import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanySettingsDto } from './dto/create-company-settings.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

// CompanySettings is a singleton table per the data model ("une seule ligne,
// jamais inseree une deuxieme fois") — there is no list/delete semantics,
// only "get the settings" and "update the settings".
@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanySettingsDto) {
    const existing = await this.prisma.companySettings.findFirst();
    if (existing) {
      throw new ConflictException(
        "Les paramètres de l'entreprise existent déjà — utilisez PATCH pour les modifier",
      );
    }
    return this.prisma.companySettings.create({ data: dto });
  }

  async find() {
    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      throw new NotFoundException("Les paramètres de l'entreprise n'ont pas encore été initialisés");
    }
    return settings;
  }

  async update(dto: UpdateCompanySettingsDto, modifiedBy: string) {
    const existing = await this.prisma.companySettings.findFirst();
    if (!existing) {
      throw new NotFoundException(
        "Les paramètres de l'entreprise n'ont pas encore été initialisés — créez-les d'abord",
      );
    }
    return this.prisma.companySettings.update({
      where: { Id: existing.Id },
      data: { ...dto, ModifiedBy: modifiedBy, ModifiedAt: new Date() },
    });
  }
}
