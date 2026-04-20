import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogBufferService } from './logs/log-buffer.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(LogBufferService);
  app.useLogger(logger);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  await app.listen(5000);
  logger.log('SSEM3 backend running on http://localhost:5000', 'Bootstrap');
}
bootstrap();
