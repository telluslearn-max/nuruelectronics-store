import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Letterhead } from "./letterhead";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  brand: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  logo: {
    maxWidth: 140,
    maxHeight: 50,
    objectFit: "contain",
  },
  brandSub: {
    fontSize: 9,
    color: "#666666",
    marginTop: 2,
  },
  docTitleBlock: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  docNumber: {
    fontSize: 10,
    color: "#666666",
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#888888",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
  },
  table: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingVertical: 6,
  },
  colTitle: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 2, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  tableHeaderText: {
    fontSize: 8,
    color: "#888888",
    textTransform: "uppercase",
  },
  totalsBlock: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  totalsLabel: {
    color: "#666666",
  },
  totalsLabelFinal: {
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 8,
  },
});

export function DocumentShell({
  docTitle,
  docNumber,
  letterhead,
  children,
}: {
  docTitle: string;
  docNumber: string;
  letterhead?: Letterhead;
  children: ReactNode;
}) {
  const companyName = letterhead?.companyName ?? "NURU Electronics";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {letterhead?.logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF node, not an HTML <img>; it has no alt prop.
              <Image src={letterhead.logoDataUri} style={styles.logo} />
            ) : (
              <Text style={styles.brand}>{companyName}</Text>
            )}
            <Text style={styles.brandSub}>nuruelectronics.com</Text>
          </View>
          <View style={styles.docTitleBlock}>
            <Text style={styles.docTitle}>{docTitle}</Text>
            <Text style={styles.docNumber}>{docNumber}</Text>
          </View>
        </View>
        {children}
        <Text style={styles.footer}>{companyName} · nuruelectronics.com</Text>
      </Page>
    </Document>
  );
}

export type Moneyish = string | number | { toString(): string };

export function LineItemsTable({
  items,
  formatMoney,
}: {
  items: { title: string; quantity: number; unitPrice: Moneyish; lineTotal: Moneyish }[];
  formatMoney: (amount: Moneyish) => string;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.colTitle, styles.tableHeaderText]}>Item</Text>
        <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
        <Text style={[styles.colPrice, styles.tableHeaderText]}>Unit price</Text>
        <Text style={[styles.colTotal, styles.tableHeaderText]}>Total</Text>
      </View>
      {items.map((item, index) => (
        <View style={styles.tableRow} key={index}>
          <Text style={styles.colTitle}>{item.title}</Text>
          <Text style={styles.colQty}>{item.quantity}</Text>
          <Text style={styles.colPrice}>{formatMoney(item.unitPrice)}</Text>
          <Text style={styles.colTotal}>{formatMoney(item.lineTotal)}</Text>
        </View>
      ))}
    </View>
  );
}

export function TotalsBlock({
  rows,
  formatMoney,
}: {
  rows: { label: string; amount: Moneyish }[];
  formatMoney: (amount: Moneyish) => string;
}) {
  const finalRow = rows[rows.length - 1];
  const otherRows = rows.slice(0, -1);
  return (
    <View style={styles.totalsBlock}>
      {otherRows.map((row) => (
        <View style={styles.totalsRow} key={row.label}>
          <Text style={styles.totalsLabel}>{row.label}</Text>
          <Text>{formatMoney(row.amount)}</Text>
        </View>
      ))}
      {finalRow && (
        <View style={styles.totalsRowFinal}>
          <Text style={styles.totalsLabelFinal}>{finalRow.label}</Text>
          <Text style={styles.totalsLabelFinal}>{formatMoney(finalRow.amount)}</Text>
        </View>
      )}
    </View>
  );
}
