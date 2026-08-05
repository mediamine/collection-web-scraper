import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

// eslint-disable-next-line @typescript-eslint/ban-types
const BigIntPrototype: BigInt & { toJSON?: () => string } = BigInt.prototype;
BigIntPrototype.toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Run onModuleDestroy hooks (Prisma $disconnect) if the process is signalled mid-run.
  app.enableShutdownHooks();

  try {
    await app.get(AppService).scrape();
  } finally {
    // Close the context so PrismaService.onModuleDestroy() runs ($disconnect),
    // releasing the connection pool instead of leaking it until the process dies.
    await app.close();
  }
}
bootstrap();
