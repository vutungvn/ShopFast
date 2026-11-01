import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import {
  ManageProductQueryDto,
  ProductQueryDto,
} from './dto/product-query.dto';
import { InventoryStatsDto } from './dto/inventory-stats.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /**
   * Danh sách sản phẩm đang bán: lọc theo danh mục, thương hiệu, khoảng giá; phân trang (công khai).
   * Header `X-Cache`: HIT (từ Redis), MISS (đọc DB), BYPASS (Redis lỗi, đọc thẳng DB).
   */
  @Get()
  async list(
    @Query() query: ProductQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const { value, status } = await this.products.listPublic(query);
    res.setHeader('X-Cache', status);
    return value;
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

  /** Số liệu tồn kho: tổng, sắp hết (≤ 5), hết hàng, ngừng bán (kho, admin) */
  @Get('manage/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.WAREHOUSE)
  stockStats(): Promise<InventoryStatsDto> {
    return this.products.stockStats();
  }

  /** Chi tiết sản phẩm đang bán theo slug (công khai), có header `X-Cache` như danh sách */
  @Get(':slug')
  async detail(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProductResponseDto> {
    const { value, status } = await this.products.findPublicBySlug(slug);
    // Gắn cả khi 404: slug lạ cũng được cache để không xuống DB liên tục
    res.setHeader('X-Cache', status);
    if (!value) throw new NotFoundException('Không tìm thấy sản phẩm');
    return value;
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
