import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApplicationService } from './application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  SetApplicationStatusDto,
  AddApplicationNoteDto,
  AddToTalentPoolDto,
  SelfApplyDto,
} from './dto/application.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@Controller('recruitment/applications')
@RequirePermission('RECRUTEMENT_ACCES')
export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Get()
  findAll(@Query('source') source?: string, @Query('jobOfferId') jobOfferId?: string) {
    return this.service.findAll({ source, jobOfferId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetApplicationStatusDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.setStatus(id, dto, employeeId);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddApplicationNoteDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.addNote(id, dto, employeeId);
  }

  @Post(':id/talent-pool')
  addToTalentPool(
    @Param('id') id: string,
    @Body() dto: AddToTalentPoolDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.addToTalentPool(id, dto, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.remove(id, employeeId);
  }
}

// Cote espace employe (US12) : postuler en interne + suivre ses candidatures
// internes. Aucune permission recrutement requise — n'importe quel employe
// connecte peut postuler a une offre publiee.
@Controller('recruitment/my-applications')
export class MyApplicationsController {
  constructor(private readonly service: ApplicationService) {}

  @Get()
  findMine(@CurrentUser('employeeId') employeeId: string) {
    return this.service.findMineInternal(employeeId);
  }

  @Post()
  selfApply(@Body() dto: SelfApplyDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.selfApply(dto.JobOfferId, employeeId);
  }
}
