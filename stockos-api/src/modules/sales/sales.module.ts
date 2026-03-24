import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesService } from './sales.service';
import {
  PurchaseOrdersController,
  SaleOrdersController,
  ChallansController,
  PaymentsController,
} from './sales.controller';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [
    PurchaseOrdersController,
    SaleOrdersController,
    ChallansController,
    PaymentsController,
  ],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
