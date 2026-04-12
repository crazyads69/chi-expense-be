import { IsString, MaxLength } from 'class-validator';

export class TextInputDto {
  @IsString()
  @MaxLength(500)
  message!: string;
}
