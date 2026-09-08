import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildOrdersWorkbookBuffer, type OrderExportRow } from "./orders-export";

const rows: OrderExportRow[] = [
  {
    orderNumber: "LB-1000",
    date: "16/1/2026, 12:00",
    customerName: "Ana Pérez",
    customerPhone: "1122334455",
    statusLabel: "Nuevo",
    itemCount: 3,
    total: 4500,
  },
  {
    orderNumber: "LB-1001",
    date: "16/1/2026, 13:30",
    customerName: "Juan Gómez",
    customerPhone: "",
    statusLabel: "Finalizado",
    itemCount: 1,
    total: 1200,
  },
];

async function loadWorkbook(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.getWorksheet("Pedidos")!;
}

describe("buildOrdersWorkbookBuffer", () => {
  it("genera una hoja 'Pedidos' con el encabezado esperado", async () => {
    const buffer = await buildOrdersWorkbookBuffer(rows);
    const sheet = await loadWorkbook(buffer);

    const headerValues = sheet.getRow(1).values as unknown[];
    expect(headerValues.slice(1)).toEqual([
      "Nº de pedido",
      "Fecha",
      "Cliente",
      "Teléfono",
      "Estado",
      "Cantidad de productos",
      "Total",
    ]);
  });

  it("escribe una fila por cada pedido, en orden, con los valores correctos", async () => {
    const buffer = await buildOrdersWorkbookBuffer(rows);
    const sheet = await loadWorkbook(buffer);

    expect(sheet.rowCount).toBe(3); // encabezado + 2 pedidos
    const firstRow = sheet.getRow(2).values as unknown[];
    expect(firstRow.slice(1)).toEqual([
      "LB-1000",
      "16/1/2026, 12:00",
      "Ana Pérez",
      "1122334455",
      "Nuevo",
      3,
      4500,
    ]);
  });

  it("genera una hoja vacía (solo encabezado) si no hay pedidos", async () => {
    const buffer = await buildOrdersWorkbookBuffer([]);
    const sheet = await loadWorkbook(buffer);
    expect(sheet.rowCount).toBe(1);
  });
});
