import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Group extends Document {
  @Prop({ required: true, unique: true })
  groupId: string;

  @Prop({ required: true })
  groupName: string;

  @Prop({ required: true })
  displayName: string;
}

export const GroupSchema = SchemaFactory.createForClass(Group); 