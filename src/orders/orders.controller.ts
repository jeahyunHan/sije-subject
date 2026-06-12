import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: '발주서 생성' })
  @ApiResponse({ status: 201, description: '발주서 생성 성공' })
  @ApiResponse({ status: 400, description: 'ORDER_CREATE_INVALID_PAYLOAD' })
  @ApiResponse({ status: 403, description: 'ORDER_CREATE_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'ORDER_ALREADY_EXISTS' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: '발주서 목록 조회' })
  @ApiResponse({ status: 200, description: '발주서 목록 조회 성공' })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':orderNo')
  @ApiOperation({ summary: '발주서 단건 조회' })
  @ApiParam({ name: 'orderNo', example: 'PO-2025-0001' })
  @ApiResponse({ status: 200, description: '최신 발주서 반환' })
  @ApiResponse({ status: 404, description: 'ORDER_NOT_FOUND' })
  findOne(@Param('orderNo') orderNo: string) {
    return this.ordersService.findOne(orderNo);
  }

  @Patch(':orderNo/confirm')
  @ApiOperation({ summary: '발주서 초기 확정' })
  @ApiParam({ name: 'orderNo', example: 'PO-2025-0001' })
  @ApiResponse({
    status: 200,
    description: 'CONFIRMED 처리 및 History v1 생성',
  })
  @ApiResponse({ status: 403, description: 'ORDER_CONFIRM_FORBIDDEN' })
  @ApiResponse({ status: 409, description: 'ORDER_CONFIRM_INVALID_STATUS' })
  confirm(
    @Param('orderNo') orderNo: string,
    @Body() confirmOrderDto: ConfirmOrderDto,
  ) {
    return this.ordersService.confirm(orderNo, confirmOrderDto);
  }
}
