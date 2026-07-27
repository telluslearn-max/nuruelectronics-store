import { Text, View } from "@react-pdf/renderer";
import { formatDocumentMoney } from "./money";
import { DocumentShell, TotalsBlock, styles, type Moneyish } from "./document-layout";
import type { Letterhead } from "./letterhead";
import type { Employee, PayRun, Payslip, PayslipDeduction } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export function PayslipDocument({
  payslip,
  employee,
  deductions,
  payRun,
  letterhead,
}: {
  payslip: Payslip;
  employee: Employee;
  deductions: PayslipDeduction[];
  payRun: PayRun;
  letterhead?: Letterhead;
}) {
  const formatMoney = (amount: Moneyish) => formatDocumentMoney(String(amount), "KES");
  const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <DocumentShell docTitle="Payslip" docNumber={payslip.number} letterhead={letterhead}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Employee</Text>
          <Text>{employee.name}</Text>
          {employee.role && <Text>{employee.role}</Text>}
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={styles.sectionLabel}>Pay period</Text>
          <Text>
            {formatDate(payRun.periodStart)} – {formatDate(payRun.periodEnd)}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.colTitle, styles.tableHeaderText]}>Deduction</Text>
          <Text style={[styles.colTotal, styles.tableHeaderText]}>Amount</Text>
        </View>
        {deductions.map((deduction) => (
          <View style={styles.tableRow} key={deduction.id}>
            <Text style={styles.colTitle}>{deduction.type}</Text>
            <Text style={styles.colTotal}>{formatMoney(deduction.amount.toString())}</Text>
          </View>
        ))}
        {deductions.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.colTitle}>No deductions</Text>
            <Text style={styles.colTotal}>—</Text>
          </View>
        )}
      </View>

      <TotalsBlock
        formatMoney={formatMoney}
        rows={[
          { label: "Gross pay", amount: payslip.grossPay.toString() },
          { label: "Total deductions", amount: `-${totalDeductions.toFixed(2)}` },
          { label: "Net pay", amount: payslip.netPay.toString() },
        ]}
      />
    </DocumentShell>
  );
}
