import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { name } from '../../../package.json';
// swagger
export const swaggerConfig = new DocumentBuilder()
  .setTitle(name)
  .setDescription(`Naga Master Data Management Service APIs documentation`)
  .setVersion('1.0')
  .addTag(name)
  .build();

export const documentOptions: SwaggerDocumentOptions = {
  deepScanRoutes: true,
};

export const options: SwaggerCustomOptions = {
  customSiteTitle: 'Application Name API Docs',
};
