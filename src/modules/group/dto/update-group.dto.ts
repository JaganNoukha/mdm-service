import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupDto {
  @ApiProperty({
    description: 'The name of the group',
    example: 'Product',
    required: false
  })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({
    description: 'The display name of the group',
    example: 'Product Master',
    required: false
  })
  @IsOptional()
  @IsString()
  displayName?: string;
} 