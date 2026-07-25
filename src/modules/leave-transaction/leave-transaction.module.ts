import { Module } from '@nestjs/common';
import { LeaveTransactionController } from './leave-transaction.controller';
import { LeaveTransactionService } from './leave-transaction.service';
import { AccrualSchedulerService } from './accrual-scheduler.service';

@Module({
  controllers: [LeaveTransactionController],
  providers: [LeaveTransactionService, AccrualSchedulerService],
  exports: [LeaveTransactionService],
})
export class LeaveTransactionModule {}
