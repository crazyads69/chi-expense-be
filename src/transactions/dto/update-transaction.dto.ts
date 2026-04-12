import { IsInt, IsString, IsOptional, MaxLength, Min } from 'class-validator';

export class UpdateTransactionDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  amount?: number;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  merchant?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
