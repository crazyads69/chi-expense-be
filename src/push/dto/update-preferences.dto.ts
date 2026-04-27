import { IsBoolean, IsString, IsInt, IsOptional, Min, Max, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: true, description: 'Enable daily summary notifications' })
  @IsOptional()
  @IsBoolean()
  dailySummaryEnabled?: boolean;

  @ApiPropertyOptional({ example: '21:00', description: 'Daily summary time in HH:MM format' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'dailySummaryTime must be in HH:MM format',
  })
  dailySummaryTime?: string;

  @ApiPropertyOptional({ example: true, description: 'Enable budget alert notifications' })
  @IsOptional()
  @IsBoolean()
  budgetAlertsEnabled?: boolean;

  @ApiPropertyOptional({ example: 80, description: 'Budget alert threshold percentage (1-100)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  budgetThreshold?: number;
}
