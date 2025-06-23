import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({
    description: 'The name of the group',
    example: 'Product',
    required: true
  })
  @IsNotEmpty()
  @IsString()
  groupName: string;

  @ApiProperty({
    description: 'The display name of the group',
    example: 'Product Master',
    required: true
  })
  @IsNotEmpty()
  @IsString()
  displayName: string;
} 