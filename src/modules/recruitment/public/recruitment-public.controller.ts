import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { RecruitmentPublicService } from './recruitment-public.service';
import { PublicApplyDto } from './dto/public-apply.dto';

// @Public() sur chaque handler — ni JWT ni permission. Les offres sont
// adressees par jeton opaque, jamais par id interne.
@Controller('public/careers')
export class RecruitmentPublicController {
  constructor(private readonly service: RecruitmentPublicService) {}

  @Public()
  @Get()
  listPublished() {
    return this.service.listPublished();
  }

  // Doit rester avant ':token'.
  @Public()
  @Post('spontaneous')
  applySpontaneous(@Body() dto: PublicApplyDto) {
    return this.service.applySpontaneous(dto);
  }

  @Public()
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.service.getByToken(token, true);
  }

  @Public()
  @Post(':token/apply')
  applyToOffer(@Param('token') token: string, @Body() dto: PublicApplyDto) {
    return this.service.applyToOffer(token, dto);
  }
}
