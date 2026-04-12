import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ImageInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15000000) // Rough max size for base64 string (~10MB limit)
  image!: string; // Base64 JPEG string
}
