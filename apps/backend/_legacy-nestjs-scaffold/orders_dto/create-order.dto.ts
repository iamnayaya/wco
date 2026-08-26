import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
  Min,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ maxLength: 500, description: 'Customer notes for this item' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export enum OrderChannel {
  WHATSAPP = 'whatsapp',
  DASHBOARD = 'dashboard',
  PAYMENT_LINK = 'payment_link',
}

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid', description: 'WCO customer record' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: [OrderItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ enum: OrderChannel })
  @IsEnum(OrderChannel)
  channel!: OrderChannel;

  @ApiPropertyOptional({ maxLength: 2000, description: 'Delivery address or pickup instructions' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deliveryAddress?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Pre-selected logistics provider quote' })
  @IsOptional()
  @IsUUID()
  shippingQuoteId?: string;
}