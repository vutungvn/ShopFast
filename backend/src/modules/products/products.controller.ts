import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ManageProductQueryDto,
  ProductQueryDto,
} from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Danh sách sản phẩm đang bán: lọc theo danh mục, thương hiệu, khoảng giá; phân trang (công khai) */
  @Get()
  list(
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    return this.products.listPublic(query);
  }

  /** Danh sách cho nhân viên, gồm cả sản phẩm ngừng bán (ADMIN, WAREHOUSE) */
  // Khai báo trước ':slug' để "manage" không bị hiểu là slug sản phẩm
  @Get('manage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.WAREHOUSE)
  manage(
    @Query() query: ManageProductQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    return this.products.listForStaff(query);
  }

  /** Chi tiết sản phẩm đang bán theo slug (công khai) */
  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<ProductResponseDto> {
    return this.products.getBySlug(slug);
  }

  /** Tạo sản phẩm kèm tồn kho ban đầu (chỉ ADMIN) */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.products.create(dto);
  }

  /**
   * Cập nhật tồn kho (kho, admin). Gửi đúng một trong hai: `stock` đặt lại số tồn (kiểm kê),
   * hoặc `delta` cộng/trừ (nhập hàng / xuất hỏng). Trừ quá số đang có => 409.
   */
  @Patch(':id/inventory')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAREHOUSE, Role.ADMIN)
  updateInventory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateInventoryDto,
  ): Promise<ProductResponseDto> {
    return this.products.updateInventory(id, dto);
  }

  /** Sửa thông tin, giá; ngừng bán bằng `isActive: false` (chỉ ADMIN) */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.products.update(id, dto);
  }
}
