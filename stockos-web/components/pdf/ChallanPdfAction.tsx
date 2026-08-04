'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { ChallanDownloadButton } from './ChallanDownloadButton';
import type { ChallanPDFData } from './ChallanPDF';

interface LineItemRow {
  quantity: number;
  unit_price: number;
  total_price: number;
  items: { standardized_name: string; product_code: string } | null;
}

interface ChallanPdfActionProps {
  challan: {
    id: string;
    challan_number: string;
    generated_at: string;
    from_address: string;
    to_address: string;
    vehicle_no: string;
    sale_order_id: string;
    sale_orders?: {
      order_number: string;
      customers?: { company_name: string; primary_contact: string | null } | null;
    } | null;
  };
  profile?: {
    company_name: string | null;
    company_address: string | null;
    company_gstin: string | null;
  } | null;
}

export function ChallanPdfAction({ challan, profile }: ChallanPdfActionProps) {
  const supabase = createClient();

  const { data: lines, isLoading } = useQuery({
    queryKey: ['challan_pdf_lines', challan.sale_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_order_lines')
        .select('quantity, unit_price, total_price, items(standardized_name, product_code)')
        .eq('sale_order_id', challan.sale_order_id)
        .returns<LineItemRow[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (isLoading || !lines) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }

  const pdfData: ChallanPDFData = {
    challan_number: challan.challan_number,
    generated_at: challan.generated_at,
    from_address: challan.from_address,
    to_address: challan.to_address,
    vehicle_no: challan.vehicle_no,
    order_number: challan.sale_orders?.order_number,
    customer_name: challan.sale_orders?.customers?.company_name ?? undefined,
    customer_contact: challan.sale_orders?.customers?.primary_contact ?? undefined,
    company_name: profile?.company_name ?? undefined,
    company_address: profile?.company_address ?? undefined,
    company_gstin: profile?.company_gstin ?? undefined,
    lines: lines.map((l) => ({
      standardized_name: l.items?.standardized_name ?? '—',
      product_code: l.items?.product_code ?? '—',
      quantity: l.quantity,
      unit_price: l.unit_price,
      total_price: l.total_price,
    })),
  };

  return <ChallanDownloadButton data={pdfData} />;
}
