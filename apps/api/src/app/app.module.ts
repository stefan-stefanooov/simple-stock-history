import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [ConfigModule, LoggingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
