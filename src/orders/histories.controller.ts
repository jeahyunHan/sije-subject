import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';

@ApiTags('histories')
@Controller('histories')
export class HistoriesController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: '전체 발주서 변경 이력 조회' })
  @ApiResponse({
    status: 200,
    description: '모든 발주서의 버전 스냅샷 목록 반환',
  })
  findAllHistories() {
    return this.ordersService.findAllHistories();
  }

  @Get(':orderNo')
  @ApiOperation({ summary: '특정 발주서 변경 이력 조회' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiResponse({
    status: 200,
    description: '해당 발주서의 버전 스냅샷 목록 반환',
  })
  @ApiResponse({ status: 404, description: 'ORDER_NOT_FOUND' })
  findHistories(@Param('orderNo') orderNo: string) {
    return this.ordersService.findHistories(orderNo);
  }

  @Get(':orderNo/versions/:version')
  @ApiOperation({ summary: '발주서 특정 버전 조회' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiParam({ name: 'version', example: 2 })
  @ApiResponse({
    status: 200,
    description: '해당 버전의 전체 발주서 스냅샷 반환',
  })
  @ApiResponse({ status: 404, description: 'ORDER_VERSION_NOT_FOUND' })
  findVersion(
    @Param('orderNo') orderNo: string,
    @Param('version') version: string,
  ) {
    return this.ordersService.findVersion(orderNo, version);
  }

  @Get(':orderNo/as-of')
  @ApiOperation({ summary: '특정 시점 기준 발주서 상태 조회' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiQuery({
    name: 'at',
    example: '2025-02-16',
    description:
      '조회 기준 일자. YYYY-MM-DD 형식이며 한국시간(Asia/Seoul) 기준 해당 날짜의 마지막 시점으로 조회',
  })
  @ApiResponse({
    status: 200,
    description: '해당 시점에 유효한 버전 스냅샷 반환',
  })
  @ApiResponse({ status: 400, description: 'ORDER_HISTORY_INVALID_QUERY' })
  @ApiResponse({ status: 404, description: 'ORDER_VERSION_AS_OF_NOT_FOUND' })
  findAsOf(@Param('orderNo') orderNo: string, @Query('at') at: string) {
    return this.ordersService.findAsOf(orderNo, at);
  }

  @Get(':orderNo/compare')
  @ApiOperation({ summary: '발주서 버전 간 비교' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiQuery({ name: 'fromVersion', example: 1 })
  @ApiQuery({ name: 'toVersion', example: 2 })
  @ApiResponse({ status: 200, description: '변경된 필드와 delta 반환' })
  @ApiResponse({
    status: 404,
    description: 'ORDER_VERSION_COMPARE_TARGET_NOT_FOUND',
  })
  compareVersions(
    @Param('orderNo') orderNo: string,
    @Query('fromVersion') fromVersion: string,
    @Query('toVersion') toVersion: string,
  ) {
    return this.ordersService.compareVersions(orderNo, fromVersion, toVersion);
  }
}
