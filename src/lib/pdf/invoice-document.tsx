import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPrice } from "@/lib/format";
import { BrandWordmark, DocumentFooter, WarrantyTerms, type Moneyish } from "./document-layout";
import type { Letterhead } from "./letterhead";
import type { Customer, Invoice, Order, OrderItem, Receipt } from "@prisma/client";
import { displayEmail } from "@/lib/customer-email";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  companyBlock: { alignItems: "flex-end" },
  accentSquare: { width: 14, height: 14, backgroundColor: "#1a1a1a", marginBottom: 10 },
  invoiceTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  companyLine: { fontSize: 9, color: "#666666", marginTop: 1 },
  billToBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    padding: 14,
    marginTop: 28,
  },
  billToLabel: { fontSize: 8, color: "#888888", textTransform: "uppercase" },
  billToValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  billToSub: { fontSize: 9, color: "#666666", marginTop: 1 },
  metaLabel: { fontSize: 8, color: "#888888", textTransform: "uppercase", textAlign: "right" },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 2, marginBottom: 6 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingBottom: 6,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
  },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },
  tableHeaderText: { fontSize: 8, color: "#888888", textTransform: "uppercase" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  itemTitle: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsLabel: { color: "#666666" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  totalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  totalValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  paidRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, marginTop: 8 },
  paidLabel: { fontSize: 9, color: "#666666" },
  amountDueBox: {
    backgroundColor: "#f5f5f5",
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountDueLabel: { fontSize: 9, color: "#666666", textTransform: "uppercase" },
  amountDueValue: { fontSize: 18, fontFamily: "Helvetica-Bold" },
});

export function InvoiceDocument({
  invoice,
  order,
  customer,
  items,
  receipts,
  letterhead,
}: {
  invoice: Invoice;
  order: Order;
  customer: Customer;
  items: OrderItem[];
  receipts: Receipt[];
  letterhead?: Letterhead;
}) {
  const formatMoney = (amount: Moneyish) => formatPrice(String(amount), order.currencyCode);
  const companyName = letterhead?.companyName ?? "NURU Electronics";
  const balanceDue = Number(invoice.total) - Number(invoice.amountPaid);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <BrandWordmark companyName={companyName} />
          <View style={s.companyBlock}>
            <View style={s.accentSquare} />
            <Text style={s.invoiceTitle}>Invoice</Text>
            <Text style={s.companyLine}>{companyName}</Text>
            {letterhead?.companyAddress && <Text style={s.companyLine}>{letterhead.companyAddress}</Text>}
            {letterhead?.companyEmail && <Text style={s.companyLine}>{letterhead.companyEmail}</Text>}
            {letterhead?.companyPhone && <Text style={s.companyLine}>{letterhead.companyPhone}</Text>}
          </View>
        </View>

        <View style={s.billToBar}>
          <View>
            <Text style={s.billToLabel}>Bill to</Text>
            <Text style={s.billToValue}>{customer.name ?? displayEmail(customer.email) ?? customer.phone ?? "Customer"}</Text>
            {displayEmail(customer.email) && <Text style={s.billToSub}>{displayEmail(customer.email)}</Text>}
            {customer.phone && <Text style={s.billToSub}>{customer.phone}</Text>}
          </View>
          <View>
            <Text style={s.metaLabel}>Invoice #</Text>
            <Text style={s.metaValue}>{invoice.number}</Text>
            <Text style={s.metaLabel}>Issued</Text>
            <Text style={s.metaValue}>{formatDate(invoice.issuedAt ?? invoice.createdAt)}</Text>
            {invoice.dueAt && (
              <>
                <Text style={s.metaLabel}>Due date</Text>
                <Text style={s.metaValue}>{formatDate(invoice.dueAt)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={s.tableHeaderRow}>
          <Text style={[s.colItem, s.tableHeaderText]}>Item</Text>
          <Text style={[s.colQty, s.tableHeaderText]}>Qty</Text>
          <Text style={[s.colPrice, s.tableHeaderText]}>Unit price</Text>
          <Text style={[s.colAmount, s.tableHeaderText]}>Amount</Text>
        </View>
        {items.map((item) => (
          <View style={s.itemRow} key={item.id}>
            <Text style={[s.colItem, s.itemTitle]}>{item.title}</Text>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colPrice}>{formatMoney(item.unitPrice.toString())}</Text>
            <Text style={[s.colAmount, s.itemTitle]}>{formatMoney(item.lineTotal.toString())}</Text>
          </View>
        ))}

        <View style={{ marginTop: 12 }}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal.toString())}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Tax</Text>
            <Text>{formatMoney(invoice.taxTotal.toString())}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Shipping</Text>
            <Text>{formatMoney(invoice.shippingTotal.toString())}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Discount</Text>
            {/* Avoid formatting "-0.00" as a signed negative-zero amount when there's no discount. */}
            <Text>{formatMoney(Number(invoice.discountTotal) > 0 ? `-${invoice.discountTotal.toString()}` : "0")}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatMoney(invoice.total.toString())}</Text>
          </View>

          {receipts.map((receipt) => (
            <View style={s.paidRow} key={receipt.id}>
              <Text style={s.paidLabel}>Paid on {formatDate(receipt.paidAt)}</Text>
              <Text style={s.paidLabel}>{formatMoney(`-${receipt.amount.toString()}`)}</Text>
            </View>
          ))}

          <View style={s.amountDueBox}>
            <Text style={s.amountDueLabel}>Amount due</Text>
            <Text style={s.amountDueValue}>{formatMoney(balanceDue.toFixed(2))}</Text>
          </View>
        </View>

        <WarrantyTerms />

        <DocumentFooter />
      </Page>
    </Document>
  );
}
