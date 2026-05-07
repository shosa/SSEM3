import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogBufferService } from './logs/log-buffer.service';

const BANNER = `
 $$$$$$\\   $$$$$$\\  $$$$$$$$\\ $$\\      $$\\  $$$$$$\\
$$  __$$\\ $$  __$$\\ $$  _____|$$$\\    $$$ |$$ ___$$\\
$$ /  \\__|$$ /  \\__|$$ |      $$$$\\  $$$$ |\\_/   $$ |
\\$$$$$$\\  \\$$$$$$\\  $$$$$\\    $$\\$$\\$$ $$ |  $$$$$ /
 \\____$$\\  \\____$$\\ $$  __|   $$ \\$$$  $$ |  \\___$$\\
$$\\   $$ |$$\\   $$ |$$ |      $$ |\\$  /$$ |$$\\   $$ |
\\$$$$$$  |\\$$$$$$  |$$$$$$$$\\ $$ | \\_/ $$ |\\$$$$$$  |
 \\______/  \\______/ \\________|\\__|     \\__| \\______/
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(LogBufferService);
  app.useLogger(logger);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api');
  await app.listen(5000);
  console.log(BANNER);
  logger.log('SSEM3 backend running on http://localhost:5000', 'Bootstrap');
}
bootstrap();
