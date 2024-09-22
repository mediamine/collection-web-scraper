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

  app.get(AppService).scrape();
}
bootstrap();
