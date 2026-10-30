import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { toStringList } from '../../../common/validation/transforms';

export class OrderQueryDto extends PaginationQueryDto {
  /**
   * Một hoặc nhiều trạng thái (tab gộp trên UI): `status=PAID,CONFIRMED,PACKING`
   * @example PAID,CONFIRMED,PACKING
   */
  @IsOptional()
  @Transform(toStringList)
  @IsArray({ message: 'status không hợp lệ' })
  @IsEnum(OrderStatus, { each: true, message: 'status không hợp lệ' })
  status?: OrderStatus[];
}
