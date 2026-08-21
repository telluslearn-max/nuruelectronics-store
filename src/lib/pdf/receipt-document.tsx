import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPrice } from "@/lib/format";
import { BrandWordmark, DocumentFooter, PhoneIcon, WarrantyTerms, type Moneyish } from "./document-layout";
import type { Letterhead } from "./letterhead";
import type { Customer, Invoice, OrderItem, Receipt } from "@prisma/client";
import { displayEmail } from "@/lib/customer-email";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  accentSquare: { width: 14, height: 14, backgroundColor: "#1a1a1a" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 },
  title: { fontSize: 30, fontFamily: "Helvetica-Bold" },
  titleUnderline: { width: 32, height: 2, backgroundColor: "#1a1a1a", marginTop: 10 },
  metaBlock: { alignItems: "flex-end" },
  metaLabel: { fontSize: 8, color: "#888888", textTransform: "uppercase" },
  metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2, marginBottom: 10 },
  customerLabel: { fontSize: 9, color: "#666666", marginTop: 20 },
  customerValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  hr: { borderTopWidth: 1, borderTopColor: "#dddddd", marginVertical: 16 },
  tableHeaderRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#dddddd" },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
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
  paymentLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 20 },
  paymentMethodRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  paymentMethodText: { fontSize: 11, fontFamily: "Helvetica-Bold", marginLeft: 8 },
  paymentStatus: { fontSize: 9, color: "#666666", marginTop: 4 },
  thankYou: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 20 },
});

export function ReceiptDocument({
  receipt,
  invoice,
  customer,
  items,
  letterhead,
}: {
  receipt: Receipt;
  invoice: Invoice;
  customer: Customer;
  items: OrderItem[];
  letterhead?: Letterhead;
}) {
  const formatMoney = (amount: Moneyish) => formatPrice(String(amount), "KES");
  const companyName = letterhead?.companyName ?? "NURU Electronics";
  const balance = Number(invoice.total) - Number(invoice.amountPaid);
  const paymentStatus =
    invoice.status === "paid" ? "Paid in full" : `Balance remaining: ${formatMoney(balance.toFixed(2))}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <BrandWordmark companyName={companyName} />
          <View style={s.accentSquare} />
        </View>

        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>Receipt</Text>
            <View style={s.titleUnderline} />
          </View>
          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Receipt No.</Text>
            <Text style={s.metaValue}>{receipt.number}</Text>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{formatDate(receipt.paidAt)}</Text>
          </View>
        </View>

        <Text style={s.customerLabel}>Customer</Text>
        <Text style={s.customerValue}>{customer.name ?? displayEmail(customer.email) ?? customer.phone ?? "Customer"}</Text>

        <View style={s.hr} />

        <View style={s.tableHeaderRow}>
          <Text style={[s.colItem, s.tableHeaderText]}>Item</Text>
          <Text style={[s.colQty, s.tableHeaderText]}>Qty</Text>
          <Text style={[s.colPrice, s.tableHeaderText]}>Price</Text>
        </View>
        {items.map((item) => (
          <View style={s.itemRow} key={item.id}>
            <Text style={[s.colItem, s.itemTitle]}>{item.title}</Text>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={[s.colPrice, s.itemTitle]}>{formatMoney(item.lineTotal.toString())}</Text>
          </View>
        ))}

        <View style={{ marginTop: 12 }}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal.toString())}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Discount</Text>
            <Text>{formatMoney(invoice.discountTotal.toString())}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatMoney(invoice.total.toString())}</Text>
          </View>
        </View>

        <Text style={s.paymentLabel}>Payment Method</Text>
        <View style={s.paymentMethodRow}>
          <PhoneIcon />
          <Text style={s.paymentMethodText}>{METHOD_LABELS[receipt.method] ?? receipt.method}</Text>
        </View>
        <Text style={s.paymentStatus}>{paymentStatus}</Text>
        {receipt.reference && <Text style={s.paymentStatus}>Reference: {receipt.reference}</Text>}

        <View style={s.hr} />

        <Text style={s.thankYou}>Thank you for choosing {companyName}.</Text>

        <WarrantyTerms />

        <DocumentFooter />
      </Page>
    </Document>
  );
}
