import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [OrdersModule, RequestsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
