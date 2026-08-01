import { Circle, Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
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

/** Splits "NURU Electronics" into a bold tracked-caps "NURU" and a smaller tracked-caps
 * "ELECTRONICS" line beneath it — used by documents (e.g. ReceiptDocument) that render their own
 * bespoke header instead of DocumentShell's compact logo/wordmark row. */
export function BrandWordmark({ companyName }: { companyName: string }) {
  const [primary, ...rest] = companyName.split(" ");
  const secondary = rest.join(" ");
  return (
    <View>
      <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 4 }}>{primary}</Text>
      {secondary && (
        <Text style={{ fontSize: 8, letterSpacing: 2, color: "#666666", marginTop: 3 }}>
          {secondary.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const bespokeStyles = StyleSheet.create({
  footerRow: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: "#999999" },
  warrantyHeading: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 6 },
  warrantyLine: { fontSize: 8, color: "#555555", marginTop: 3, lineHeight: 1.4 },
  warrantyLabel: { fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  warrantyClaim: { fontSize: 8, color: "#555555", marginTop: 6, lineHeight: 1.4 },
});

/** A plain phone glyph — stands in for whichever method was actually used (cash/M-Pesa are both
 * collected/confirmed on a phone in this store's workflow), so one icon covers both without
 * needing per-method artwork. */
export function PhoneIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth={2}>
      <Path d="M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <Path d="M11 18h2" />
    </Svg>
  );
}

/** Decorative monochrome social glyphs — generic circle marks rather than exact brand icons, so
 * this doesn't depend on the store's real social handles/links. */
function SocialGlyphs() {
  const marks = ["IG", "FB", "X"];
  return (
    <View style={{ flexDirection: "row" }}>
      {marks.map((mark) => (
        <View key={mark} style={{ marginLeft: 8 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={11} fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

/** Shared footer for the bespoke (non-DocumentShell) documents — website + decorative social marks. */
export function DocumentFooter() {
  return (
    <View style={bespokeStyles.footerRow}>
      <Text style={bespokeStyles.footerText}>nuruelectronics.com</Text>
      <SocialGlyphs />
    </View>
  );
}

/** Condensed from the real Refund & Warranty Policy (src/app/(storefront)/legal/refund-policy) —
 * ordered coverage → return window → exclusions → how to claim, not a restatement of different
 * rules. Keep this in sync if that policy changes. */
const WARRANTY_TERMS: { label: string; body: string }[] = [
  {
    label: "Manufacturer warranty.",
    body: " New, sealed products are covered by the manufacturer's own warranty.",
  },
  {
    label: "Our 1-year warranty.",
    body:
      " Ex-UK (unboxed) units aren't covered by the manufacturer, but come with our own 1-year warranty against defects and hardware faults.",
  },
  {
    label: "7-day returns.",
    body: " Unused items in original packaging, with all accessories, can be returned within 7 days of delivery.",
  },
  {
    label: "Not covered.",
    body: " Accidental or liquid damage, unauthorized repairs, and normal wear and tear.",
  },
];

export function WarrantyTerms() {
  return (
    <View>
      <Text style={bespokeStyles.warrantyHeading}>Warranty &amp; Returns</Text>
      {WARRANTY_TERMS.map((term) => (
        <Text style={bespokeStyles.warrantyLine} key={term.label}>
          <Text style={bespokeStyles.warrantyLabel}>{term.label}</Text>
          {term.body}
        </Text>
      ))}
      <Text style={bespokeStyles.warrantyClaim}>
        To start a claim, message us on WhatsApp. Full policy at nuruelectronics.com/legal/refund-policy.
      </Text>
    </View>
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
