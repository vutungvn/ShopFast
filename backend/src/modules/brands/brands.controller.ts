import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { BrandsService } from './brands.service';
import { BrandDto } from './dto/brand-response.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  /** Danh sách thương hiệu theo tên (công khai) */
  @Get()
  list(): Promise<BrandDto[]> {
    return this.brands.list();
  }

  /** Tạo thương hiệu (chỉ ADMIN) */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateBrandDto): Promise<BrandDto> {
    return this.brands.create(dto);
  }

  /** Sửa tên hoặc slug (chỉ ADMIN) */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandDto> {
    return this.brands.update(id, dto);
  }

  /** Xoá thương hiệu chưa có sản phẩm (chỉ ADMIN) */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MessageResponseDto> {
    await this.brands.remove(id);
    return { message: 'Đã xoá thương hiệu' };
  }
}
