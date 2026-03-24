import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CrmService } from './crm.service';
import { VendorsController, CustomersController } from './crm.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VendorsController, CustomersController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
