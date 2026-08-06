import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SharePointService } from './sharepoint.service';
import type { AttachmentEntityType } from './dto/upload-attachment.dto';

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharePoint: SharePointService,
  ) {}

  async upload(
    entityType: AttachmentEntityType,
    entityId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ) {
    const { url, size } = await this.sharePoint.uploadFile(file.originalname, file.buffer, file.mimetype);
    return this.prisma.attachment.create({
      data: {
        EntityType: entityType,
        EntityId: entityId,
        FileName: file.originalname,
        FileUrl: url,
        FileSize: size,
        MimeType: file.mimetype,
        CreatedBy: uploadedBy,
      },
    });
  }

  findByEntity(entityType: AttachmentEntityType, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { EntityType: entityType, EntityId: entityId },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  async remove(id: string, requesterId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { Id: id } });
    if (!attachment) {
      throw new NotFoundException(`Pièce jointe ${id} introuvable`);
    }
    if (attachment.CreatedBy !== requesterId) {
      throw new ForbiddenException("Vous ne pouvez supprimer que vos propres pièces jointes");
    }
    // Le fichier reste sur SharePoint (pas d'appel DELETE Graph) — on retire
    // seulement le lien applicatif ; simplicite deliberee (evite un dossier
    // "Upload" qui grossit indefiniment n'est pas un objectif de ce lot).
    return this.prisma.attachment.delete({ where: { Id: id } });
  }
}
