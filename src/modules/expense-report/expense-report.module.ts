import { Module } from '@nestjs/common';
import { ExpenseReportController } from './expense-report.controller';
import { ExpenseReportService } from './expense-report.service';
import { ApprovalPoolModule } from '../approval-pool/approval-pool.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ApprovalPoolModule, NotificationModule],
  controllers: [ExpenseReportController],
  providers: [ExpenseReportService],
  exports: [ExpenseReportService],
})
export class ExpenseReportModule {}
