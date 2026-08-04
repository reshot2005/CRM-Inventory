'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatCurrency } from '@/lib/utils/format';

export interface ChallanLineItem {
  standardized_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ChallanPDFData {
  challan_number: string;
  generated_at: string;
  from_address: string;
  to_address: string;
  vehicle_no: string;
  order_number?: string;
  customer_name?: string;
  customer_contact?: string;
  company_name?: string;
  company_address?: string;
  company_gstin?: string;
  lines: ChallanLineItem[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  companyName: { fontSize: 16, fontWeight: 'bold' },
  companyMeta: { fontSize: 9, color: '#64748b', marginTop: 2 },
  docTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e90ff', textTransform: 'uppercase' },
  docMeta: { fontSize: 9, color: '#64748b', marginTop: 2, textAlign: 'right' },
  divider: { borderBottomWidth: 2, borderBottomColor: '#e2e8f0', marginVertical: 14 },
  parties: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  party: { flex: 1 },
  partyLabel: { fontSize: 8, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 },
  partyText: { fontSize: 10, lineHeight: 1.4 },
  vehicle: { fontSize: 10, marginBottom: 14 },
  table: { marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 8 },
  tableTotal: { flexDirection: 'row', borderWidth: 1, borderTopWidth: 0, borderColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#f8fafc' },
  th: { fontSize: 8, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  td: { fontSize: 9 },
  colSr: { width: '6%' },
  colName: { width: '30%' },
  colCode: { width: '16%' },
  colQty: { width: '12%', textAlign: 'right' },
  colPrice: { width: '18%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 48 },
  sigBlock: { width: 160, alignItems: 'center' },
  sigLine: { borderTopWidth: 1, borderTopColor: '#334155', width: '100%', marginBottom: 4 },
  sigLabel: { fontSize: 8, color: '#64748b' },
});

export function ChallanPDFDocument({ data }: { data: ChallanPDFData }) {
  const grandTotal = data.lines.reduce((s, l) => s + l.total_price, 0);
  const dateStr = new Date(data.generated_at).toLocaleDateString('en-IN');

  return (
    <Document title={`Challan ${data.challan_number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{data.company_name ?? 'Company Name'}</Text>
            {data.company_address ? <Text style={styles.companyMeta}>{data.company_address}</Text> : null}
            {data.company_gstin ? <Text style={styles.companyMeta}>GSTIN: {data.company_gstin}</Text> : null}
          </View>
          <View>
            <Text style={styles.docTitle}>Delivery Challan</Text>
            <Text style={styles.docMeta}>{data.challan_number}</Text>
            <Text style={styles.docMeta}>Date: {dateStr}</Text>
            {data.order_number ? <Text style={styles.docMeta}>Order: {data.order_number}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Ship From</Text>
            <Text style={styles.partyText}>{data.from_address}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Ship To</Text>
            {data.customer_name ? <Text style={[styles.partyText, { fontWeight: 'bold' }]}>{data.customer_name}</Text> : null}
            <Text style={styles.partyText}>{data.to_address}</Text>
            {data.customer_contact ? <Text style={styles.partyText}>Contact: {data.customer_contact}</Text> : null}
          </View>
        </View>

        {data.vehicle_no ? (
          <Text style={styles.vehicle}>Vehicle No: {data.vehicle_no}</Text>
        ) : null}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colSr]}>Sr.</Text>
            <Text style={[styles.th, styles.colName]}>Item</Text>
            <Text style={[styles.th, styles.colCode]}>Code</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {data.lines.map((line, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.td, styles.colSr]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.colName]}>{line.standardized_name}</Text>
              <Text style={[styles.td, styles.colCode]}>{line.product_code}</Text>
              <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
              <Text style={[styles.td, styles.colPrice]}>{formatCurrency(line.unit_price)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{formatCurrency(line.total_price)}</Text>
            </View>
          ))}
          <View style={styles.tableTotal}>
            <Text style={[styles.td, { width: '82%', textAlign: 'right', fontWeight: 'bold' }]}>Grand Total</Text>
            <Text style={[styles.td, styles.colTotal, { fontWeight: 'bold' }]}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Received By</Text>
          </View>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
