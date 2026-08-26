import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Lagos Fabrics Hub', maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'lagos-fabrics-hub' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{2,48}$/, { message: 'Lowercase letters, digits and dashes only' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Premium Ankara and lace fabrics' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'E.164 format required' })
  whatsappNumber?: string;

  @ApiPropertyOptional({ enum: ['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD'] })
  @IsOptional()
  @IsIn(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD'])
  currency?: string;

  @ApiPropertyOptional({ example: 'Africa/Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ enum: ['NG', 'GH', 'KE', 'ZA'] })
  @IsOptional()
  @IsIn(['NG', 'GH', 'KE', 'ZA'])
  country?: string;
}

export class ConnectWhatsappDto {
  @ApiProperty({ example: '+2348012345678' })
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'E.164 format required' })
  whatsappNumber!: string;

  @ApiPropertyOptional({ description: 'Meta Cloud API phone_number_id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  whatsappNameId?: string;
}
