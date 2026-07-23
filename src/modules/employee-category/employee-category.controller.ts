import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EmployeeCategoryService } from './employee-category.service';
import { CreateEmployeeCategoryDto } from './dto/create-employee-category.dto';
import { UpdateEmployeeCategoryDto } from './dto/update-employee-category.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('employee-categories')
export class EmployeeCategoryController {
  constructor(private readonly service: EmployeeCategoryService) {}

  @Post()
  @RequirePermission('CONFIG_CATEGORIES_EMPLOYE')
  create(@Body() dto: CreateEmployeeCategoryDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('CONFIG_CATEGORIES_EMPLOYE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeCategoryDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  @RequirePermission('CONFIG_CATEGORIES_EMPLOYE')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
