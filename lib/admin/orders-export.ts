import ExcelJS from "exceljs";

export interface OrderExportRow {
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  statusLabel: string;
  itemCount: number;
  total: number;
}

export async function buildOrdersWorkbookBuffer(orders: OrderExportRow[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pedidos");

  sheet.columns = [
    { header: "Nº de pedido", key: "orderNumber", width: 16 },
    { header: "Fecha", key: "date", width: 20 },
    { header: "Cliente", key: "customerName", width: 28 },
    { header: "Teléfono", key: "customerPhone", width: 16 },
    { header: "Estado", key: "statusLabel", width: 14 },
    { header: "Cantidad de productos", key: "itemCount", width: 20 },
    { header: "Total", key: "total", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("total").numFmt = "#,##0.00";

  for (const order of orders) {
    sheet.addRow(order);
  }

  return workbook.xlsx.writeBuffer();
}
