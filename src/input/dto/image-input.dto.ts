import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class ImageInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15000000) // Rough max size for base64 string (~10MB limit)
  @Matches(/^data:image\/(jpeg|png);base64,/, {
    message:
      'Image must be a valid base64 data URI starting with data:image/jpeg;base64, or data:image/png;base64,',
  })
  image!: string;
}
