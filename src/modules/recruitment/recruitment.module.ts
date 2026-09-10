import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { RecruitmentNotifyService } from './recruitment-notify.service';

import { HiringRequestController } from './hiring-request/hiring-request.controller';
import { HiringRequestService } from './hiring-request/hiring-request.service';
import { JobOfferController } from './job-offer/job-offer.controller';
import { JobOfferService } from './job-offer/job-offer.service';
import { EvalTemplateController } from './eval-template/eval-template.controller';
import { EvalTemplateService } from './eval-template/eval-template.service';
import { ApplicationController, MyApplicationsController } from './application/application.controller';
import { ApplicationService } from './application/application.service';
import { InterviewController } from './interview/interview.controller';
import { InterviewService } from './interview/interview.service';
import {
  ContractController,
  ContractTemplateController,
} from './contract/contract.controller';
import { ContractService } from './contract/contract.service';
import { TrialController } from './trial/trial.controller';
import { TrialService } from './trial/trial.service';
import { TalentPoolController } from './talent-pool/talent-pool.controller';
import { TalentPoolService } from './talent-pool/talent-pool.service';
import { RecruitmentPublicController } from './public/recruitment-public.controller';
import { RecruitmentPublicService } from './public/recruitment-public.service';

// Module Recrutement (branche dev-recrutement-module) — un seul module qui
// regroupe toutes les sous-entites du domaine, cablees sur les memes
// services d'effets de bord (notifications, emails, temps reel) via
// RecruitmentNotifyService.
@Module({
  imports: [MailModule, NotificationModule, RealtimeModule],
  controllers: [
    HiringRequestController,
    JobOfferController,
    EvalTemplateController,
    ApplicationController,
    MyApplicationsController,
    InterviewController,
    ContractController,
    ContractTemplateController,
    TrialController,
    TalentPoolController,
    RecruitmentPublicController,
  ],
  providers: [
    RecruitmentNotifyService,
    HiringRequestService,
    JobOfferService,
    EvalTemplateService,
    ApplicationService,
    InterviewService,
    ContractService,
    TrialService,
    TalentPoolService,
    RecruitmentPublicService,
  ],
})
export class RecruitmentModule {}
