import { Text, View } from "@react-pdf/renderer";
import { formatDocumentMoney } from "./money";
import { DocumentShell, LineItemsTable, TotalsBlock, styles, type Moneyish } from "./document-layout";
import type { Letterhead } from "./letterhead";
import type { Customer, Estimate, Order, OrderItem } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export function EstimateDocument({
  estimate,
  order,
  customer,
  items,
  letterhead,
}: {
  estimate: Estimate;
  order: Order;
  customer: Customer;
  items: OrderItem[];
  letterhead?: Letterhead;
}) {
  const formatMoney = (amount: Moneyish) => formatDocumentMoney(String(amount), order.currencyCode);

  return (
    <DocumentShell docTitle="Estimate" docNumber={estimate.number} letterhead={letterhead}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Prepared for</Text>
          <Text>{customer.name ?? customer.email}</Text>
          <Text>{customer.email}</Text>
          {customer.phone && <Text>{customer.phone}</Text>}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.sectionLabel}>Details</Text>
          <Text>Issued: {formatDate(estimate.createdAt)}</Text>
          <Text>Valid until: {formatDate(estimate.validUntil)}</Text>
          <Text>Status: {estimate.status}</Text>
        </View>
      </View>

      <LineItemsTable items={items} formatMoney={formatMoney} />

      <TotalsBlock
        formatMoney={formatMoney}
        rows={[
          { label: "Subtotal", amount: estimate.subtotal.toString() },
          { label: "Tax", amount: estimate.taxTotal.toString() },
          { label: "Shipping", amount: estimate.shippingTotal.toString() },
          { label: "Discount", amount: `-${estimate.discountTotal.toString()}` },
          { label: "Total", amount: estimate.total.toString() },
        ]}
      />
    </DocumentShell>
  );
}
