import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', description: 'Expo push token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'ios', description: 'Device platform', enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: string;
}
