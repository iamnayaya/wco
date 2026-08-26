import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'amaka@lagosfabrics.ng' })
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Amaka Okafor', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  /**
   * Password policy tuned for real-world usability in emerging markets:
   * length over composition rules (NIST 800-63B). Breach-list checking
   * happens server-side against HIBP k-anonymity API.
   */
  @ApiProperty({ example: 'correct-horse-battery', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'NG', enum: ['NG', 'GH', 'KE', 'ZA'] })
  @IsIn(['NG', 'GH', 'KE', 'ZA'])
  country = 'NG';

  @ApiProperty({ example: '+2348012345678', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must be E.164 format' })
  phone?: string;
}
