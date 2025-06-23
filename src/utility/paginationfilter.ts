import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class PaginationFilter {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  readonly page?: number;
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(10)
  limit: number;

  @IsString()
  @IsOptional()
  @MinLength(3)
  search: string;
}
