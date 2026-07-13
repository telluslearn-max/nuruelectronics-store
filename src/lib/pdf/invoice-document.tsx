import { Text, View } from "@react-pdf/renderer";
import { formatPrice } from "@/lib/format";
import { DocumentShell, LineItemsTable, TotalsBlock, styles, type Moneyish } from "./document-layout";
import type { Customer, Invoice, Order, OrderItem } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export function InvoiceDocument({
  invoice,
  order,
  customer,
  items,
}: {
  invoice: Invoice;
  order: Order;
  customer: Customer;
  items: OrderItem[];
}) {
  const formatMoney = (amount: Moneyish) => formatPrice(String(amount), order.currencyCode);
  const balanceDue = Number(invoice.total) - Number(invoice.amountPaid);

  return (
    <DocumentShell docTitle="Invoice" docNumber={invoice.number}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Bill to</Text>
          <Text>{customer.name ?? customer.email}</Text>
          <Text>{customer.email}</Text>
          {customer.phone && <Text>{customer.phone}</Text>}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.sectionLabel}>Details</Text>
          <Text>Issued: {formatDate(invoice.issuedAt ?? invoice.createdAt)}</Text>
          {invoice.dueAt && <Text>Due: {formatDate(invoice.dueAt)}</Text>}
          <Text>Status: {invoice.status}</Text>
        </View>
      </View>

      <LineItemsTable items={items} formatMoney={formatMoney} />

      <TotalsBlock
        formatMoney={formatMoney}
        rows={[
          { label: "Subtotal", amount: invoice.subtotal.toString() },
          { label: "Tax", amount: invoice.taxTotal.toString() },
          { label: "Shipping", amount: invoice.shippingTotal.toString() },
          { label: "Discount", amount: `-${invoice.discountTotal.toString()}` },
          { label: "Total", amount: invoice.total.toString() },
          { label: "Amount paid", amount: `-${invoice.amountPaid.toString()}` },
          { label: "Balance due", amount: balanceDue.toFixed(2) },
        ]}
      />
    </DocumentShell>
  );
}
