import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { JobOfferService } from './job-offer.service';
import { CreateJobOfferDto } from './dto/create-job-offer.dto';
import { UpdateJobOfferDto, CloseJobOfferDto } from './dto/update-job-offer.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

// RECRUTEMENT_ACCES ouvre tout le module (decision client du 05/09) : une
// seule permission de classe, pas d'etape "approuver / refuser".
@Controller('recruitment/job-offers')
@RequirePermission('RECRUTEMENT_ACCES')
export class JobOfferController {
  constructor(private readonly service: JobOfferService) {}

  @Post()
  create(@Body() dto: CreateJobOfferDto, @CurrentUser('employeeId') employeeId: string) {
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
    @Body() dto: UpdateJobOfferDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.update(id, dto, employeeId);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.publish(id, employeeId);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseJobOfferDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    return this.service.close(id, dto, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.remove(id, employeeId);
  }
}
