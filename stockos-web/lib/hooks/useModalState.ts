'use client';

import { useCallback, useState } from 'react';

export function useModalState<T>() {
  const [item, setItem] = useState<T | null>(null);
  const openCreate = useCallback(() => setItem(null), []);
  const openEdit = useCallback((next: T) => setItem(next), []);
  const close = useCallback(() => setItem(null), []);
  return { item, isOpen: item !== null, openCreate, openEdit, close, setItem };
}
