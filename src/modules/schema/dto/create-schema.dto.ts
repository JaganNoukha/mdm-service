import { IsString, IsArray, ValidateNested, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateIf } from 'class-validator';
import { FieldType, RelationshipType } from 'src/common/enums/mdm.enum';

export class FieldDefinition {
  @IsString()
  @ValidateIf((o) => o.type !== FieldType.MASTER)
  name: string;

  @IsEnum(FieldType)
  type: FieldType;

  @IsBoolean()
  @IsOptional()
  required?: boolean;


  @IsBoolean()
  @IsOptional()
  unique?: boolean;


  @IsOptional()
  defaultValue?: any;

  @IsOptional()
  validationRules?: Record<string, any>;

  @IsString()
  @ValidateIf((o) => o.type === FieldType.MASTER)
  masterType?: string;

  @IsEnum(RelationshipType)
  @ValidateIf((o) => o.type === FieldType.MASTER)
  relationshipType?: RelationshipType;
}

export class CreateSchemaDto {

  @IsString()
  name: string;


  @IsString()
  displayName: string;


  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinition)
  fields: FieldDefinition[];


  @IsArray()
  @IsString({ each: true })
  @ValidateIf((o) => o.groups !== undefined)
  groupId?: string;
} 