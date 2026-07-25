import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LeaveTransactionService } from './leave-transaction.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('leave-transactions')
export class LeaveTransactionController {
  constructor(private readonly service: LeaveTransactionService) {}

  @Get()
  @RequirePermission('CONGE_VOIR_TOUT')
  findAll(@Query('employeeId') employeeId?: string) {
    return this.service.findAll(employeeId);
  }

  @Get('balance/mine')
  getMyBalances(@CurrentUser('employeeId') employeeId: string) {
    return this.service.getBalances(employeeId);
  }

  // Doit rester avant ':employeeId' — sinon Nest matcherait "all" comme id.
  @Get('balance/all')
  @RequirePermission('CONGE_VOIR_TOUT')
  getAllBalances() {
    return this.service.getAllBalances();
  }

  @Get('balance/:employeeId')
  @RequirePermission('CONGE_VOIR_TOUT')
  getBalances(@Param('employeeId') employeeId: string) {
    return this.service.getBalances(employeeId);
  }

  // Déclenchement manuel (en plus du cron quotidien, voir AccrualSchedulerService)
  // — permet au RH de forcer une génération sans attendre le jour configuré.
  @Post('generate-accruals')
  @RequirePermission('CONFIG_TYPES_CONGE')
  generateAccruals(@CurrentUser('employeeId') employeeId: string) {
    return this.service.generateAccruals(employeeId);
  }
}
