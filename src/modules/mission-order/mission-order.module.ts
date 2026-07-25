import { Module } from '@nestjs/common';
import { MissionOrderController } from './mission-order.controller';
import { MissionOrderService } from './mission-order.service';
import { ApprovalPoolModule } from '../approval-pool/approval-pool.module';

@Module({
  imports: [ApprovalPoolModule],
  controllers: [MissionOrderController],
  providers: [MissionOrderService],
  exports: [MissionOrderService],
})
export class MissionOrderModule {}
