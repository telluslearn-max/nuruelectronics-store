import { Text, View } from "@react-pdf/renderer";
import { formatPrice } from "@/lib/format";
import { DocumentShell, TotalsBlock, styles, type Moneyish } from "./document-layout";
import type { Customer, Invoice, Receipt } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
};

export function ReceiptDocument({
  receipt,
  invoice,
  customer,
}: {
  receipt: Receipt;
  invoice: Invoice;
  customer: Customer;
}) {
  const formatMoney = (amount: Moneyish) => formatPrice(String(amount), "KES");

  return (
    <DocumentShell docTitle="Receipt" docNumber={receipt.number}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Received from</Text>
          <Text>{customer.name ?? customer.email}</Text>
          <Text>{customer.email}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.sectionLabel}>Details</Text>
          <Text>Date: {formatDate(receipt.paidAt)}</Text>
          <Text>Against invoice: {invoice.number}</Text>
          <Text>Method: {METHOD_LABELS[receipt.method] ?? receipt.method}</Text>
          {receipt.reference && <Text>Reference: {receipt.reference}</Text>}
        </View>
      </View>

      <TotalsBlock
        formatMoney={formatMoney}
        rows={[
          { label: "Invoice total", amount: invoice.total.toString() },
          { label: "Amount received", amount: receipt.amount.toString() },
        ]}
      />
      <Text style={{ marginTop: 8, fontSize: 9, color: "#666666" }}>
        Remaining balance on {invoice.number}: {formatMoney((Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2))}
      </Text>
    </DocumentShell>
  );
}
