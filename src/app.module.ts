import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { PrismaMediamineService, PrismaService } from './db';
import { WinstonLoggerService } from './logger';
import { CompleteScanModule } from './workflow';
import { PageTextScanModule } from './workflow/page-text-scan/page-text-scan.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.dev', '.env.prod']
    }),
    CompleteScanModule,
    PageTextScanModule
  ],
  controllers: [],
  providers: [AppService, WinstonLoggerService, PrismaMediamineService, PrismaService]
})
export class AppModule {}
