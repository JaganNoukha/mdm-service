import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { AppLoggerService } from './common/logger/logger.service';
import { TraceContextMiddleware } from './common/middleware/trace.middleware';
import { RequestContextService } from './common/middleware/request.service';
import { MasterModule } from './modules/master/master.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GroupModule } from './modules/group/group.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      envFilePath: ['.env']
    }),
    EventEmitterModule.forRoot(),
    MasterModule,
    GroupModule
  ],
  controllers: [AppController],
  providers: [AppService, AppLoggerService, RequestContextService],
  exports: [AppLoggerService, RequestContextService]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceContextMiddleware).forRoutes('*');
  }
}
