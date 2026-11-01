import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CacheService } from '../../infra/cache/cache.service';
import { CacheStatsDto } from '../../infra/cache/dto/cache-stats.dto';

@ApiTags('Cache')
@Controller('cache')
export class CacheController {
  constructor(private readonly cache: CacheService) {}

  /** Số lần trúng/trượt cache từ lần xoá cache gần nhất (chỉ ADMIN) */
  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  stats(): Promise<CacheStatsDto> {
    return this.cache.stats();
  }
}
