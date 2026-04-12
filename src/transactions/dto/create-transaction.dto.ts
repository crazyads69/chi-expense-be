import {
  IsInt,
  IsString,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateTransactionDto {
  @IsInt()
  @Min(1) // Assuming negative amount is handled on client or normalized here
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  merchant!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsIn(['text', 'voice', 'image', 'sms', 'manual'])
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
