'use client';

import InventoryPageClient from '../inventory/InventoryPageClient';

export default function FinishedGoodsPage() {
  return (
    <InventoryPageClient defaultCategory="FINISHED_GOOD" lockCategory />
  );
}
