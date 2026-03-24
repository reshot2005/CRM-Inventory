import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Delete all tables in FK-safe order ──
  console.log('  Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.deliveryChallan.deleteMany();
  await prisma.saleOrderLine.deleteMany();
  await prisma.moveOrderLine.deleteMany();
  await prisma.moveOrder.deleteMany();
  await prisma.saleOrder.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.document.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.productionMaterialLine.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.bOMLine.deleteMany();
  await prisma.bOM.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.vendorItem.deleteMany();
  await prisma.vendorContact.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.customerActivity.deleteMany();
  await prisma.customerContact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.item.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  console.log('  ✓ Cleaned');

  // ── 2. Users ──
  console.log('  Creating users...');
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const managerHash = await bcrypt.hash('Manager@123', 12);
  const staffHash = await bcrypt.hash('Staff@123', 12);
  const pendingHash = await bcrypt.hash('Pending@123', 12);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@stockos.com',
      passwordHash: adminHash,
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      allowedLocations: [],
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@stockos.com',
      passwordHash: managerHash,
      name: 'Manager User',
      role: 'MANAGER',
      status: 'ACTIVE',
      allowedLocations: [],
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@stockos.com',
      passwordHash: staffHash,
      name: 'Staff User',
      role: 'STAFF',
      status: 'ACTIVE',
      allowedLocations: [],
    },
  });

  await prisma.user.create({
    data: {
      email: 'pending@stockos.com',
      passwordHash: pendingHash,
      name: 'Pending User',
      role: 'STAFF',
      status: 'PENDING',
      allowedLocations: [],
    },
  });
  console.log('  ✓ 4 users created');

  // ── 3. Locations ──
  console.log('  Creating locations...');
  const factory = await prisma.location.create({
    data: { name: 'Factory', code: 'FAC-001', type: 'FACTORY', address: 'Bhiwandi Industrial Area, Mumbai' },
  });
  const mumbaiHub = await prisma.location.create({
    data: { name: 'Mumbai Hub', code: 'HUB-MUM', type: 'HUB', address: 'Andheri East, Mumbai' },
  });
  const delhiHub = await prisma.location.create({
    data: { name: 'Delhi Hub', code: 'HUB-DEL', type: 'HUB', address: 'Okhla Phase II, Delhi' },
  });
  const puneHub = await prisma.location.create({
    data: { name: 'Pune Hub', code: 'HUB-PUN', type: 'HUB', address: 'Hinjawadi Phase I, Pune' },
  });
  console.log('  ✓ 4 locations created');

  // ── 4. Items ──
  console.log('  Creating items...');
  const raw001 = await prisma.item.create({
    data: { standardizedName: 'HDPE Granules', productCode: 'RAW-001', brand: 'Reliance', category: 'RAW_MATERIAL', minStockLevel: 500 },
  });
  const raw002 = await prisma.item.create({
    data: { standardizedName: 'PP Granules', productCode: 'RAW-002', brand: 'Haldia Petro', category: 'RAW_MATERIAL', minStockLevel: 300 },
  });
  const raw003 = await prisma.item.create({
    data: { standardizedName: 'PVC Granules', productCode: 'RAW-003', brand: 'Chemplast', category: 'RAW_MATERIAL', minStockLevel: 200 },
  });
  const raw004 = await prisma.item.create({
    data: { standardizedName: 'LDPE Film Roll', productCode: 'RAW-004', brand: 'IOCL', category: 'RAW_MATERIAL', packagingType: 'ROLL', minStockLevel: 200 },
  });
  const raw005 = await prisma.item.create({
    data: { standardizedName: 'Master Batch Black', productCode: 'RAW-005', brand: 'Poddar', category: 'RAW_MATERIAL', minStockLevel: 50 },
  });
  const raw006 = await prisma.item.create({
    data: { standardizedName: 'Color Master Batch', productCode: 'RAW-006', brand: 'Poddar', category: 'RAW_MATERIAL', minStockLevel: 100 },
  });

  const pkg001 = await prisma.item.create({
    data: { standardizedName: 'PP Woven Sack 50kg', productCode: 'PKG-001', category: 'PACKAGING', packagingType: 'SACKS', minStockLevel: 500 },
  });
  const pkg002 = await prisma.item.create({
    data: { standardizedName: 'Corrugated Sheet B', productCode: 'PKG-002', category: 'PACKAGING', packagingType: 'SHEET', minStockLevel: 100 },
  });
  const pkg003 = await prisma.item.create({
    data: { standardizedName: 'Stretch Wrap Film', productCode: 'PKG-003', category: 'PACKAGING', packagingType: 'ROLL', minStockLevel: 100 },
  });
  const pkg004 = await prisma.item.create({
    data: { standardizedName: 'Adhesive Label 100x50', productCode: 'PKG-004', category: 'PACKAGING', packagingType: 'OTHERS', minStockLevel: 1000 },
  });
  const pkg005 = await prisma.item.create({
    data: { standardizedName: 'BOPP Tape 48mm', productCode: 'PKG-005', category: 'PACKAGING', packagingType: 'ROLL', minStockLevel: 200 },
  });

  const fg001 = await prisma.item.create({
    data: { standardizedName: 'HDPE Pipe 50mm', productCode: 'FG-001', brand: 'StockOS', category: 'FINISHED_GOOD', packagingSize: '50mm', minStockLevel: 100 },
  });
  const fg002 = await prisma.item.create({
    data: { standardizedName: 'PP Woven Bag 50kg', productCode: 'FG-002', brand: 'StockOS', category: 'FINISHED_GOOD', packagingType: 'BAGS', minStockLevel: 500 },
  });
  const fg003 = await prisma.item.create({
    data: { standardizedName: 'LDPE Mulch Film', productCode: 'FG-003', brand: 'StockOS', category: 'FINISHED_GOOD', packagingType: 'ROLL', minStockLevel: 200 },
  });
  const fg004 = await prisma.item.create({
    data: { standardizedName: 'PVC Profile', productCode: 'FG-004', brand: 'StockOS', category: 'FINISHED_GOOD', minStockLevel: 50 },
  });
  console.log('  ✓ 15 items created');

  // ── 5. Inventory ──
  console.log('  Creating inventory...');
  const locations = [factory, mumbaiHub, delhiHub, puneHub];

  const inventoryData: { item: typeof raw001; quantities: number[]; unitCost: number }[] = [
    { item: raw001, quantities: [100, 20, 13, 10], unitCost: 125 },
    { item: raw002, quantities: [300, 100, 80, 80], unitCost: 108 },
    { item: raw003, quantities: [120, 40, 20, 20], unitCost: 145 },
    { item: raw004, quantities: [500, 200, 100, 90], unitCost: 92 },
    { item: raw005, quantities: [30, 10, 5, 0], unitCost: 210 },
    { item: raw006, quantities: [60, 30, 20, 10], unitCost: 185 },
    { item: pkg001, quantities: [1000, 500, 400, 300], unitCost: 18 },
    { item: pkg002, quantities: [5, 2, 1, 0], unitCost: 42 },
    { item: pkg003, quantities: [200, 80, 40, 20], unitCost: 340 / 10 },
    { item: pkg004, quantities: [100, 50, 30, 20], unitCost: 2.5 },
    { item: pkg005, quantities: [200, 100, 80, 70], unitCost: 28 },
    { item: fg001, quantities: [150, 50, 30, 20], unitCost: 320 },
    { item: fg002, quantities: [800, 300, 200, 200], unitCost: 45 },
    { item: fg003, quantities: [500, 150, 100, 50], unitCost: 180 },
    { item: fg004, quantities: [80, 20, 10, 10], unitCost: 260 },
  ];

  for (const entry of inventoryData) {
    for (let i = 0; i < 4; i++) {
      if (entry.quantities[i] > 0) {
        await prisma.inventory.create({
          data: {
            locationId: locations[i].id,
            itemId: entry.item.id,
            quantity: entry.quantities[i],
            reservedQty: 0,
            unitCost: entry.unitCost,
          },
        });
      }
    }
  }
  console.log('  ✓ Inventory created');

  // ── 6. Vendors + Contacts + VendorItems ──
  console.log('  Creating vendors...');
  const vendor1 = await prisma.vendor.create({
    data: {
      vendorId: 'VEN-0001',
      companyName: 'Sharma Polymers',
      gstin: '27AABCS1429B1ZB',
      paymentTerms: 'NET_30',
    },
  });
  await prisma.vendorContact.create({
    data: {
      vendorId: vendor1.id,
      name: 'Ramesh Sharma',
      role: 'Owner',
      phones: ['+91-9812345678'],
      email: 'ramesh@sharmapolymers.com',
      isPrimary: true,
    },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor1.id, itemId: raw001.id, unitPrice: 125, leadTimeDays: 7, isPreferred: true },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor1.id, itemId: raw002.id, unitPrice: 108, leadTimeDays: 7, isPreferred: true },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      vendorId: 'VEN-0002',
      companyName: 'PackRight Co.',
      gstin: '29AABCP9021K1ZA',
      paymentTerms: 'NET_30',
    },
  });
  await prisma.vendorContact.create({
    data: {
      vendorId: vendor2.id,
      name: 'Priya Nair',
      role: 'Sales Manager',
      phones: ['+91-9823456789'],
      email: 'priya@packright.co.in',
      isPrimary: true,
    },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor2.id, itemId: pkg001.id, unitPrice: 18, leadTimeDays: 5, isPreferred: true },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor2.id, itemId: pkg002.id, unitPrice: 42, leadTimeDays: 5, isPreferred: true },
  });

  const vendor3 = await prisma.vendor.create({
    data: {
      vendorId: 'VEN-0003',
      companyName: 'RawMat India',
      gstin: '06AABCR1234M1ZC',
      paymentTerms: 'NET_30',
    },
  });
  await prisma.vendorContact.create({
    data: {
      vendorId: vendor3.id,
      name: 'Suresh Mehta',
      role: 'Director',
      phones: ['+91-9834567890'],
      email: 'suresh@rawmatindia.com',
      isPrimary: true,
    },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor3.id, itemId: raw003.id, unitPrice: 145, leadTimeDays: 10, isPreferred: true },
  });
  await prisma.vendorItem.create({
    data: { vendorId: vendor3.id, itemId: raw005.id, unitPrice: 210, leadTimeDays: 10, isPreferred: true },
  });
  console.log('  ✓ 3 vendors with contacts and items created');

  // ── 7. Customers + Contacts ──
  console.log('  Creating customers...');
  const cust1 = await prisma.customer.create({
    data: {
      customerId: 'CUS-0001',
      type: 'BUSINESS',
      companyName: 'Acme Traders',
      primaryContact: 'Vikram Singh',
      phones: ['+91-9845678901'],
      address: 'Mumbai',
      paymentTerms: 'NET_30',
      creditLimit: 500000,
    },
  });
  await prisma.customerContact.create({
    data: {
      customerId: cust1.id,
      name: 'Vikram Singh',
      role: 'Procurement Head',
      phones: ['+91-9845678901'],
      email: 'vikram@acmetraders.in',
      isPrimary: true,
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      customerId: 'CUS-0002',
      type: 'BUSINESS',
      companyName: 'RetailX India',
      primaryContact: 'Anita Patel',
      phones: ['+91-9856789012'],
      address: 'Delhi',
      paymentTerms: 'NET_30',
      creditLimit: 300000,
    },
  });
  await prisma.customerContact.create({
    data: {
      customerId: cust2.id,
      name: 'Anita Patel',
      role: 'Purchase Manager',
      phones: ['+91-9856789012'],
      email: 'anita@retailxindia.com',
      isPrimary: true,
    },
  });

  const cust3 = await prisma.customer.create({
    data: {
      customerId: 'CUS-0003',
      type: 'BUSINESS',
      companyName: 'BuildFast Co.',
      primaryContact: 'Mohit Sharma',
      phones: ['+91-9867890123'],
      address: 'Pune',
      paymentTerms: 'NET_30',
      creditLimit: 200000,
    },
  });
  await prisma.customerContact.create({
    data: {
      customerId: cust3.id,
      name: 'Mohit Sharma',
      role: 'Owner',
      phones: ['+91-9867890123'],
      email: 'mohit@buildfast.co.in',
      isPrimary: true,
    },
  });
  console.log('  ✓ 3 customers with contacts created');

  // ── 8. BOMs + BOM Lines ──
  console.log('  Creating BOMs...');
  const bom1 = await prisma.bOM.create({
    data: {
      finishedGoodId: fg001.id,
      version: '1.0',
      yieldQty: 1,
      yieldUnit: 'meter',
      isActive: true,
      notes: 'BOM for HDPE Pipe 50mm — 1 meter output',
    },
  });
  await prisma.bOMLine.create({
    data: { bomId: bom1.id, rawMaterialId: raw001.id, quantity: 1.1, unit: 'kg', wastePercent: 5 },
  });
  await prisma.bOMLine.create({
    data: { bomId: bom1.id, rawMaterialId: raw005.id, quantity: 0.02, unit: 'kg', wastePercent: 2 },
  });

  const bom2 = await prisma.bOM.create({
    data: {
      finishedGoodId: fg002.id,
      version: '1.0',
      yieldQty: 1,
      yieldUnit: 'bag',
      isActive: true,
      notes: 'BOM for PP Woven Bag 50kg — 1 bag output',
    },
  });
  await prisma.bOMLine.create({
    data: { bomId: bom2.id, rawMaterialId: raw002.id, quantity: 0.18, unit: 'kg', wastePercent: 3 },
  });
  await prisma.bOMLine.create({
    data: { bomId: bom2.id, rawMaterialId: pkg004.id, quantity: 1, unit: 'pc', wastePercent: 0 },
  });
  console.log('  ✓ 2 BOMs with lines created');

  // ── 9. Stock Ledger Entries ──
  console.log('  Creating stock ledger entries...');
  const ledgerEntries: Parameters<typeof prisma.stockLedger.create>[0]['data'][] = [
    // Week 3 ago — Initial inbound shipments
    { locationId: factory.id, itemId: raw001.id, movementType: 'IN', quantity: 200, balanceAfter: 200, unitCost: 125, referenceType: 'PURCHASE', referenceId: 'PO-SEED-001', notes: 'Initial stock from Sharma Polymers', createdBy: staffUser.id, createdAt: daysAgo(21) },
    { locationId: factory.id, itemId: raw002.id, movementType: 'IN', quantity: 500, balanceAfter: 500, unitCost: 108, referenceType: 'PURCHASE', referenceId: 'PO-SEED-001', notes: 'Initial stock from Sharma Polymers', createdBy: staffUser.id, createdAt: daysAgo(21) },
    { locationId: factory.id, itemId: raw003.id, movementType: 'IN', quantity: 150, balanceAfter: 150, unitCost: 145, referenceType: 'PURCHASE', referenceId: 'PO-SEED-002', notes: 'Initial PVC stock from RawMat India', createdBy: staffUser.id, createdAt: daysAgo(20) },
    { locationId: factory.id, itemId: pkg001.id, movementType: 'IN', quantity: 1500, balanceAfter: 1500, unitCost: 18, referenceType: 'PURCHASE', referenceId: 'PO-SEED-003', notes: 'Packaging from PackRight', createdBy: staffUser.id, createdAt: daysAgo(20) },
    { locationId: factory.id, itemId: raw004.id, movementType: 'IN', quantity: 600, balanceAfter: 600, unitCost: 92, referenceType: 'PURCHASE', referenceId: 'PO-SEED-004', notes: 'LDPE Film Roll inbound', createdBy: staffUser.id, createdAt: daysAgo(19) },

    // Week 2 ago — Production and transfers
    { locationId: factory.id, itemId: raw001.id, movementType: 'PRODUCTION_OUT', quantity: 55, balanceAfter: 145, unitCost: 125, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-001', notes: 'Consumed for HDPE Pipe 50mm production', createdBy: managerUser.id, createdAt: daysAgo(14) },
    { locationId: factory.id, itemId: raw005.id, movementType: 'PRODUCTION_OUT', quantity: 1, balanceAfter: 29, unitCost: 210, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-001', notes: 'Master batch consumed', createdBy: managerUser.id, createdAt: daysAgo(14) },
    { locationId: factory.id, itemId: fg001.id, movementType: 'PRODUCTION_IN', quantity: 50, balanceAfter: 50, unitCost: 320, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-001', notes: '50 meters HDPE Pipe produced', createdBy: managerUser.id, createdAt: daysAgo(14) },
    { locationId: factory.id, itemId: raw002.id, movementType: 'PRODUCTION_OUT', quantity: 90, balanceAfter: 410, unitCost: 108, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-002', notes: 'Consumed for PP Woven Bag production', createdBy: managerUser.id, createdAt: daysAgo(13) },
    { locationId: factory.id, itemId: fg002.id, movementType: 'PRODUCTION_IN', quantity: 500, balanceAfter: 500, unitCost: 45, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-002', notes: '500 PP Woven Bags produced', createdBy: managerUser.id, createdAt: daysAgo(13) },

    // Transfers to hubs
    { locationId: factory.id, itemId: fg001.id, movementType: 'TRANSFER_OUT', quantity: 30, balanceAfter: 170, unitCost: 320, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-001', notes: 'Transfer to Mumbai Hub', createdBy: staffUser.id, createdAt: daysAgo(12) },
    { locationId: mumbaiHub.id, itemId: fg001.id, movementType: 'TRANSFER_IN', quantity: 30, balanceAfter: 30, unitCost: 320, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-001', notes: 'Received from Factory', createdBy: staffUser.id, createdAt: daysAgo(12) },
    { locationId: factory.id, itemId: fg002.id, movementType: 'TRANSFER_OUT', quantity: 200, balanceAfter: 300, unitCost: 45, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-002', notes: 'Transfer to Delhi Hub', createdBy: staffUser.id, createdAt: daysAgo(11) },
    { locationId: delhiHub.id, itemId: fg002.id, movementType: 'TRANSFER_IN', quantity: 200, balanceAfter: 200, unitCost: 45, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-002', notes: 'Received from Factory', createdBy: staffUser.id, createdAt: daysAgo(11) },

    // Week 1 ago — Sales and adjustments
    { locationId: mumbaiHub.id, itemId: fg001.id, movementType: 'OUT', quantity: 10, balanceAfter: 50, unitCost: 320, referenceType: 'SALE_ORDER', referenceId: 'SO-SEED-001', notes: 'Sold to Acme Traders', createdBy: staffUser.id, createdAt: daysAgo(7) },
    { locationId: delhiHub.id, itemId: fg002.id, movementType: 'OUT', quantity: 50, balanceAfter: 150, unitCost: 45, referenceType: 'SALE_ORDER', referenceId: 'SO-SEED-002', notes: 'Sold to RetailX India', createdBy: staffUser.id, createdAt: daysAgo(6) },
    { locationId: factory.id, itemId: raw003.id, movementType: 'ADJUSTMENT', quantity: -30, balanceAfter: 120, unitCost: 145, referenceType: 'ADJUSTMENT', referenceId: 'ADJ-SEED-001', notes: 'Count correction after physical audit', createdBy: managerUser.id, createdAt: daysAgo(5) },
    { locationId: factory.id, itemId: pkg001.id, movementType: 'TRANSFER_OUT', quantity: 500, balanceAfter: 1000, unitCost: 18, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-003', notes: 'Transfer to Mumbai Hub', createdBy: staffUser.id, createdAt: daysAgo(5) },
    { locationId: mumbaiHub.id, itemId: pkg001.id, movementType: 'TRANSFER_IN', quantity: 500, balanceAfter: 500, unitCost: 18, referenceType: 'MOVE_ORDER', referenceId: 'MO-SEED-003', notes: 'Received from Factory', createdBy: staffUser.id, createdAt: daysAgo(5) },

    // Recent — more production, returns, additional inbound
    { locationId: factory.id, itemId: raw001.id, movementType: 'IN', quantity: 50, balanceAfter: 145, unitCost: 125, referenceType: 'PURCHASE', referenceId: 'PO-SEED-005', notes: 'Replenishment from Sharma Polymers', createdBy: staffUser.id, createdAt: daysAgo(3) },
    { locationId: puneHub.id, itemId: fg003.id, movementType: 'OUT', quantity: 20, balanceAfter: 50, unitCost: 180, referenceType: 'SALE_ORDER', referenceId: 'SO-SEED-003', notes: 'Sold to BuildFast Co.', createdBy: staffUser.id, createdAt: daysAgo(3) },
    { locationId: mumbaiHub.id, itemId: fg001.id, movementType: 'RETURN', quantity: 5, balanceAfter: 55, unitCost: 320, referenceType: 'SALE_ORDER', referenceId: 'SO-SEED-001', notes: 'Partial return from Acme Traders — damaged', createdBy: staffUser.id, createdAt: daysAgo(2) },
    { locationId: factory.id, itemId: raw002.id, movementType: 'IN', quantity: 100, balanceAfter: 310, unitCost: 108, referenceType: 'PURCHASE', referenceId: 'PO-SEED-006', notes: 'PP Granules top-up', createdBy: staffUser.id, createdAt: daysAgo(1) },
    { locationId: factory.id, itemId: fg003.id, movementType: 'PRODUCTION_IN', quantity: 100, balanceAfter: 600, unitCost: 180, referenceType: 'PRODUCTION', referenceId: 'PRD-SEED-003', notes: 'LDPE Mulch Film batch completed', createdBy: managerUser.id, createdAt: daysAgo(1) },
    { locationId: delhiHub.id, itemId: pkg005.id, movementType: 'ADJUSTMENT', quantity: -5, balanceAfter: 75, unitCost: 28, referenceType: 'ADJUSTMENT', referenceId: 'ADJ-SEED-002', notes: 'Damaged tape rolls written off', createdBy: managerUser.id, createdAt: daysAgo(1) },
  ];

  for (const entry of ledgerEntries) {
    await prisma.stockLedger.create({ data: entry });
  }
  console.log(`  ✓ ${ledgerEntries.length} stock ledger entries created`);

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
