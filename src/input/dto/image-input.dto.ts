import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImageInputDto {
  @ApiProperty({ example: 'data:image/jpeg;base64,/9j/4AAQ...', description: 'Base64-encoded receipt image (JPEG or PNG)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15000000)
  @Matches(/^data:image\/(jpeg|png);base64,/, {
    message:
      'Image must be a valid base64 data URI starting with data:image/jpeg;base64, or data:image/png;base64,',
  })
  image!: string;
}
