import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { CompleteScanModule, PageTextScanModule, RssScanModule } from './workflow';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.dev', '.env.prod']
    }),
    CompleteScanModule,
    PageTextScanModule,
    RssScanModule
  ],
  controllers: [],
  providers: [AppService, WinstonLoggerService, PrismaService]
})
export class AppModule {}
