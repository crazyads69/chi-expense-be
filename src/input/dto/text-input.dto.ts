import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TextInputDto {
  @ApiProperty({ example: 'cà phê 35k', description: 'Raw Vietnamese expense text' })
  @IsString()
  @MaxLength(500)
  message!: string;
}
