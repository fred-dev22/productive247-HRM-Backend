import { Module } from '@nestjs/common';
import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequestService } from './leave-request.service';
import { ApprovalPoolModule } from '../approval-pool/approval-pool.module';
import { LeaveTransactionModule } from '../leave-transaction/leave-transaction.module';

@Module({
  imports: [ApprovalPoolModule, LeaveTransactionModule],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
