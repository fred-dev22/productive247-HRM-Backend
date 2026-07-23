import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApprovalPoolService } from './approval-pool.service';
import { CreateApprovalPoolDto } from './dto/create-approval-pool.dto';
import { UpdateApprovalPoolDto } from './dto/update-approval-pool.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('approval-pools')
export class ApprovalPoolController {
  constructor(private readonly service: ApprovalPoolService) {}

  @Post()
  create(@Body() dto: CreateApprovalPoolDto, @CurrentUser('employeeId') employeeId: string) {
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
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApprovalPoolDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
