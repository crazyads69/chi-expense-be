import {
  IsInt,
  IsString,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ example: 35000, description: 'Transaction amount in VND' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'Highlands Coffee', description: 'Merchant name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merchant!: string;

  @ApiProperty({ example: 'food', description: 'Category slug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 'manual', description: 'Input source type', enum: ['text', 'voice', 'image', 'sms', 'manual'] })
  @IsIn(['text', 'voice', 'image', 'sms', 'manual'])
  source!: string;

  @ApiPropertyOptional({ example: 'Morning coffee with team', description: 'Optional note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
