import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Purchase Order Management API')
    .setDescription(
      '의류 생산 발주서 생성, 변경 요청, 승인/반려, 버전 이력 조회 API',
    )
    .setVersion('1.0')
    .addTag('orders', '발주서 생성, 확정, 최신 상태 조회')
    .addTag('histories', '발주서 변경 이력, 버전, 시점 조회, 버전 비교')
    .addTag('requests', '변경 요청 생성, 조회, 승인, 반려')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api-docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
