import { Module } from '@nestjs/common';
import {
  ItemsController,
  MoveOrdersController,
  StockController,
  LocationsController,
} from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [
    ItemsController,
    MoveOrdersController,
    StockController,
    LocationsController,
  ],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
