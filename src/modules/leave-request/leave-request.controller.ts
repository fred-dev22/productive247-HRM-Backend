import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentPermissions } from '../../common/decorators/current-permissions.decorator';

@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly service: LeaveRequestService) {}

  @Post()
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.create(dto, employeeId, permissions.has('CONGE_VOIR_TOUT'));
  }

  // Doit rester avant ':id' — sinon Nest matcherait ces segments comme des id.
  @Get('mine')
  findMine(@CurrentUser('employeeId') employeeId: string) {
    return this.service.findMine(employeeId);
  }

  @Get('team')
  @RequirePermission('CONGE_VOIR_EQUIPE')
  findTeam(@CurrentUser('employeeId') employeeId: string) {
    return this.service.findTeam(employeeId);
  }

  @Get('pending-for-me')
  @RequirePermission('CONGE_VALIDER')
  findPendingForMe(@CurrentUser('employeeId') employeeId: string) {
    return this.service.findPendingForMe(employeeId);
  }

  @Get()
  @RequirePermission('CONGE_VOIR_TOUT')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveRequestDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.remove(id, employeeId);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.submit(id, employeeId);
  }

  @Patch(':id/approve')
  @RequirePermission('CONGE_VALIDER')
  approve(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.approve(id, dto, employeeId, permissions.has('CONGE_VOIR_TOUT'));
  }

  @Patch(':id/reject')
  @RequirePermission('CONGE_VALIDER')
  reject(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.reject(id, dto, employeeId, permissions.has('CONGE_VOIR_TOUT'));
  }

  @Patch(':id/return')
  @RequirePermission('CONGE_VALIDER')
  return_(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.return_(id, dto, employeeId, permissions.has('CONGE_VOIR_TOUT'));
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser('employeeId') employeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.cancel(id, employeeId, permissions.has('CONGE_VOIR_TOUT'));
  }

  @Patch(':id/mark-done')
  markDone(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.markDone(id, employeeId);
  }

  @Patch(':id/regularize')
  regularize(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.regularize(id, employeeId);
  }
}
