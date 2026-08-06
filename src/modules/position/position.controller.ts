import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PositionService } from './position.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BulkImportDto } from '../../common/dto/bulk-import.dto';

@Controller('positions')
export class PositionController {
  constructor(private readonly service: PositionService) {}

  @Post()
  create(@Body() dto: CreatePositionDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkImportDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.bulkCreate(dto.items, employeeId);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('available')
  findAvailable() {
    return this.service.findAvailable();
  }

  @Get('by-unit/:unitId')
  findByUnit(@Param('unitId') unitId: string) {
    return this.service.findByUnit(unitId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
