import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { LocalStorageService } from './local-storage.service';
import { SharePointService } from './sharepoint.service';
import { StorageSettingsController } from './storage-settings.controller';
import { StorageSettingsService } from './storage-settings.service';

@Module({
  controllers: [AttachmentController, StorageSettingsController],
  providers: [AttachmentService, SharePointService, LocalStorageService, StorageSettingsService],
  // Exporte pour que les notifications puissent joindre les justificatifs
  // aux emails de validation (voir WorkflowNotifierService).
  exports: [AttachmentService, StorageSettingsService],
})
export class AttachmentModule {}
