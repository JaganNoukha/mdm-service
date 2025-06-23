import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';
import mongoose from 'mongoose';

@Global() 
@Module({
  imports: [
    MongooseModule.forRoot(databaseConfig.mongoUri),
  ],
  exports: [MongooseModule], 
})
export class DatabaseModule {
    constructor() {
        if (process.env.DB_DEBUG === 'true') {
            mongoose.set('debug', true); 
        }
      }
}
