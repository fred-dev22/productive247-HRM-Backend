import 'dotenv/config';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      // Sans exceptionFactory, Nest renvoie tel quel le texte par defaut de
      // class-validator (toujours en anglais, ex: "email must be an email")
      // — le frontend l'affiche directement (voir getApiErrorMessage). La
      // plupart des champs sont deja valides cote formulaire Vue ; cette
      // erreur ne sert donc que de filet de securite, un message francais
      // generique suffit plutot que de traduire chaque decorateur DTO un a un.
      exceptionFactory: () =>
        new BadRequestException(
          'Certains champs du formulaire sont invalides ou manquants. Veuillez vérifier vos saisies.',
        ),
    }),
  );
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapter));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
