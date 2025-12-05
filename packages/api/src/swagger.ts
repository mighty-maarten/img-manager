import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export const setupSwagger = (app: INestApplication) => {
    const config = new DocumentBuilder()
        .setTitle('IMG Manager API')
        .setDescription('API for IMG Manager.')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {});
};
