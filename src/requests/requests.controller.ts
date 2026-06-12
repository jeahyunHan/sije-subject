import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { FindRequestsQueryDto } from './dto/find-requests-query.dto';
import { ReviewRequestDto } from './dto/review-request.dto';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: '변경 요청 생성' })
  @ApiResponse({ status: 201, description: '변경 요청 생성 성공' })
  @ApiResponse({ status: 400, description: '변경 항목/수량/납기일 정책 오류' })
  @ApiResponse({ status: 403, description: 'CHANGE_REQUEST_CREATE_FORBIDDEN' })
  @ApiResponse({
    status: 409,
    description: '대기 중 요청 존재 또는 변경 불가 상태',
  })
  create(@Body() createRequestDto: CreateRequestDto) {
    return this.requestsService.create(createRequestDto);
  }

  @Get()
  @ApiOperation({ summary: '변경 요청 목록 조회' })
  @ApiQuery({ name: 'orderNo', required: false, example: 'PO-2025-0001' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'REJECTED',
  })
  @ApiResponse({ status: 200, description: '변경 요청 목록 반환' })
  @ApiResponse({ status: 400, description: 'CHANGE_REQUEST_INVALID_QUERY' })
  findAll(@Query() query: FindRequestsQueryDto) {
    return this.requestsService.findAll(query);
  }

  @Patch(':orderNo/approve')
  @ApiOperation({ summary: '발주서의 대기 중 변경 요청 승인' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiResponse({
    status: 200,
    description: '해당 발주서의 Pending Request 승인 및 History 생성',
  })
  @ApiResponse({ status: 403, description: 'CHANGE_REQUEST_REVIEW_FORBIDDEN' })
  @ApiResponse({
    status: 404,
    description: 'CHANGE_REQUEST_PENDING_NOT_FOUND',
  })
  @ApiResponse({
    status: 409,
    description: '이미 처리된 요청 또는 변경 불가 상태',
  })
  approve(
    @Param('orderNo') orderNo: string,
    @Body() reviewRequestDto: ReviewRequestDto,
  ) {
    return this.requestsService.approvePendingByOrderNo(
      orderNo,
      reviewRequestDto,
    );
  }

  @Patch(':orderNo/reject')
  @ApiOperation({ summary: '발주서의 대기 중 변경 요청 반려' })
  @ApiParam({ name: 'orderNo', example: 'PO-2026-000001' })
  @ApiResponse({
    status: 200,
    description: '해당 발주서의 Pending Request 반려. Order/History 변경 없음',
  })
  @ApiResponse({ status: 403, description: 'CHANGE_REQUEST_REVIEW_FORBIDDEN' })
  @ApiResponse({
    status: 404,
    description: 'CHANGE_REQUEST_PENDING_NOT_FOUND',
  })
  @ApiResponse({ status: 409, description: '이미 처리된 요청' })
  reject(
    @Param('orderNo') orderNo: string,
    @Body() reviewRequestDto: ReviewRequestDto,
  ) {
    return this.requestsService.rejectPendingByOrderNo(
      orderNo,
      reviewRequestDto,
    );
  }
}
