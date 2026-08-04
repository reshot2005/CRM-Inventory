'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChallanPDFDocument, type ChallanPDFData } from './ChallanPDF';

export function ChallanDownloadButton({ data }: { data: ChallanPDFData }) {
  const fileName = `${data.challan_number.replace(/\s+/g, '_')}.pdf`;

  return (
    <PDFDownloadLink
      document={<ChallanPDFDocument data={data} />}
      fileName={fileName}
    >
      {({ loading }) => (
        <Button variant="ghost" size="sm" disabled={loading} className="h-7 px-2 text-xs">
          <Download className="mr-1 h-3 w-3" />
          {loading ? 'Generating…' : 'PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
