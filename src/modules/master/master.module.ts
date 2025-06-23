import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { SchemaModule } from '../schema/schema.module';

@Module({
  imports: [SchemaModule],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService]
})
export class MasterModule {}
