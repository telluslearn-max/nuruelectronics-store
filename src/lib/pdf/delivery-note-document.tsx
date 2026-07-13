import { Text, View } from "@react-pdf/renderer";
import { DocumentShell, styles } from "./document-layout";
import type { DeliveryNote, Order, OrderItem } from "@prisma/client";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export function DeliveryNoteDocument({
  note,
  order,
  items,
}: {
  note: DeliveryNote;
  order: Order;
  items: OrderItem[];
}) {
  return (
    <DocumentShell docTitle="Delivery Note" docNumber={note.number}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Deliver to</Text>
          <Text>{note.recipientName}</Text>
          <Text>{note.deliveryAddress}</Text>
          {note.recipientPhone && <Text>{note.recipientPhone}</Text>}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.sectionLabel}>Details</Text>
          <Text>Order: {order.shopifyOrderName ?? order.id}</Text>
          {note.deliveryMethod && <Text>Method: {note.deliveryMethod}</Text>}
          <Text>Status: {note.status}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colTitle, styles.tableHeaderText]}>Item</Text>
          <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
        </View>
        {items.map((item) => (
          <View style={styles.tableRow} key={item.id}>
            <Text style={styles.colTitle}>{item.title}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 40 }}>
        <Text style={styles.sectionLabel}>Received by</Text>
        <Text>{note.receivedBy ?? "_______________________"}</Text>
        <Text style={{ marginTop: 4, color: "#666666" }}>Delivered: {formatDate(note.deliveredAt)}</Text>
      </View>
    </DocumentShell>
  );
}
