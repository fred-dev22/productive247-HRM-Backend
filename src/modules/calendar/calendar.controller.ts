import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('calendars')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Post()
  @RequirePermission('CONFIG_CALENDRIER')
  create(@Body() dto: CreateCalendarDto, @CurrentUser('employeeId') employeeId: string) {
    return this.service.create(dto, employeeId);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('default')
  findDefault() {
    return this.service.findDefault();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('CONFIG_CALENDRIER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCalendarDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Delete(':id')
  @RequirePermission('CONFIG_CALENDRIER')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
