import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaModule } from './db';
import { WinstonLoggerService } from './logger';
import { CompleteScanModule, PageTextScanModule, PageTextScanV2Module, RssScanModule } from './workflow';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.dev', '.env.prod']
    }),
    PrismaModule,
    CompleteScanModule,
    PageTextScanModule,
    PageTextScanV2Module,
    RssScanModule
  ],
  controllers: [],
  providers: [AppService, WinstonLoggerService]
})
export class AppModule {}
