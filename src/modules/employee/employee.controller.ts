import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentPermissions } from '../../common/decorators/current-permissions.decorator';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Post()
  @RequirePermission('EMPLOYE_CREER')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Get()
  @RequirePermission('EMPLOYE_VOIR_TOUT')
  findAll() {
    return this.service.findAll();
  }

  // Doivent être déclarées avant ':id' — sinon Nest matcherait GET
  // /employees/team ou /employees/next-number comme findOne('team'/...).
  @Get('team')
  @RequirePermission('EMPLOYE_VOIR_EQUIPE')
  findTeam(@CurrentUser('employeeId') employeeId: string) {
    return this.service.findTeam(employeeId);
  }

  // Pas de @RequirePermission ici, volontairement — voir doc de
  // findDirectory() : accessible à tout compte authentifié.
  @Get('directory')
  findDirectory() {
    return this.service.findDirectory();
  }

  @Get('next-number')
  @RequirePermission('EMPLOYE_CREER')
  async nextNumber() {
    return { EmployeeNumber: await this.service.generateEmployeeNumber() };
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('employeeId') requesterEmployeeId: string,
    @CurrentPermissions() permissions: Set<string>,
  ) {
    return this.service.findOneForRequester(id, requesterEmployeeId, permissions);
  }

  @Patch(':id')
  @RequirePermission('EMPLOYE_MODIFIER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  @RequirePermission('EMPLOYE_DESACTIVER')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
