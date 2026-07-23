import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationUnitModule } from './modules/organization-unit/organization-unit.module';
import { JobModule } from './modules/job/job.module';
import { PositionModule } from './modules/position/position.module';
import { UserModule } from './modules/user/user.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { ApprovalPoolModule } from './modules/approval-pool/approval-pool.module';
import { ApprovalPoolMemberModule } from './modules/approval-pool-member/approval-pool-member.module';
import { LeaveTypeModule } from './modules/leave-type/leave-type.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { HolidayModule } from './modules/holiday/holiday.module';
import { CompanySettingsModule } from './modules/company-settings/company-settings.module';
import { EmployeeCategoryModule } from './modules/employee-category/employee-category.module';
import { ExpenseTypeModule } from './modules/expense-type/expense-type.module';
import { ExpenseConfigModule } from './modules/expense-config/expense-config.module';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationUnitModule,
    JobModule,
    PositionModule,
    UserModule,
    EmployeeModule,
    ApprovalPoolModule,
    ApprovalPoolMemberModule,
    LeaveTypeModule,
    CalendarModule,
    HolidayModule,
    CompanySettingsModule,
    EmployeeCategoryModule,
    ExpenseTypeModule,
    ExpenseConfigModule,
    RbacModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
