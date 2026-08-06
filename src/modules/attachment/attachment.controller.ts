import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentService } from './attachment.service';
import { UploadAttachmentDto, ATTACHMENT_ENTITY_TYPES, type AttachmentEntityType } from './dto/upload-attachment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo — largement suffisant pour un justificatif scanne/photo.

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser('employeeId') employeeId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    return this.service.upload(dto.EntityType, dto.EntityId, file, employeeId);
  }

  @Get()
  findByEntity(@Query('entityType') entityType: AttachmentEntityType, @Query('entityId') entityId: string) {
    if (!ATTACHMENT_ENTITY_TYPES.includes(entityType)) {
      throw new BadRequestException('entityType invalide');
    }
    return this.service.findByEntity(entityType, entityId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('employeeId') employeeId: string) {
    return this.service.remove(id, employeeId);
  }
}
