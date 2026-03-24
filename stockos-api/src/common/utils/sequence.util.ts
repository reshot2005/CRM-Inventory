import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type SequenceDb = Pick<PrismaService, 'sequenceCounter'>;

/**
 * Atomically increments a named counter and returns the new value (starts at 1).
 */
export async function nextSequenceValue(
  prisma: SequenceDb,
  key: string,
): Promise<number> {
  const row = await prisma.sequenceCounter.upsert({
    where: { id: key },
    create: { id: key, current: 1 },
    update: { current: { increment: 1 } },
  });
  return row.current;
}

/** e.g. PO-2026-0001, MO-2026-0042 */
export async function nextYearlyFormattedId(
  prisma: SequenceDb,
  prefix: string,
  year: number,
): Promise<string> {
  const key = `${prefix}-${year}`;
  const n = await nextSequenceValue(prisma, key);
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

/** e.g. VEN-0001, CUS-0042 */
export async function nextPaddedGlobalId(
  prisma: SequenceDb,
  key: string,
  displayPrefix: string,
): Promise<string> {
  const n = await nextSequenceValue(prisma, key);
  return `${displayPrefix}-${String(n).padStart(4, '0')}`;
}

/** Use inside `prisma.$transaction` callbacks */
export async function nextYearlyFormattedIdTx(
  tx: Pick<Prisma.TransactionClient, 'sequenceCounter'>,
  prefix: string,
  year: number,
): Promise<string> {
  const key = `${prefix}-${year}`;
  const row = await tx.sequenceCounter.upsert({
    where: { id: key },
    create: { id: key, current: 1 },
    update: { current: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(row.current).padStart(4, '0')}`;
}

export async function nextPaddedGlobalIdTx(
  tx: Pick<Prisma.TransactionClient, 'sequenceCounter'>,
  key: string,
  displayPrefix: string,
): Promise<string> {
  const row = await tx.sequenceCounter.upsert({
    where: { id: key },
    create: { id: key, current: 1 },
    update: { current: { increment: 1 } },
  });
  return `${displayPrefix}-${String(row.current).padStart(4, '0')}`;
}
