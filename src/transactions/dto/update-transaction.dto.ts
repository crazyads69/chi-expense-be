import { IsInt, IsString, IsOptional, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: 35000, description: 'Transaction amount in VND' })
  @IsInt()
  @Min(1)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ example: 'Highlands Coffee', description: 'Merchant name' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  merchant?: string;

  @ApiPropertyOptional({ example: 'food', description: 'Category slug' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'Morning coffee with team', description: 'Optional note' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
