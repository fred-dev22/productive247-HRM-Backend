import { Module } from '@nestjs/common';
import { ExpenseReportController } from './expense-report.controller';
import { ExpenseReportService } from './expense-report.service';
import { ApprovalPoolModule } from '../approval-pool/approval-pool.module';

@Module({
  imports: [ApprovalPoolModule],
  controllers: [ExpenseReportController],
  providers: [ExpenseReportService],
  exports: [ExpenseReportService],
})
export class ExpenseReportModule {}
