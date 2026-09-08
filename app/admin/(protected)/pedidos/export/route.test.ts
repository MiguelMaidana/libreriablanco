import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

const mockGetViewAccess = vi.fn();
vi.mock("@/lib/auth/permissions", () => ({
  getViewAccess: (...args: unknown[]) => mockGetViewAccess(...args),
}));

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };

function createMockQuery() {
  const query: {
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    then: (resolve: (value: typeof queryResult) => unknown) => Promise<unknown>;
  } = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lt: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve) => Promise.resolve(queryResult).then(resolve),
  };
  return query;
}

const mockSelect = vi.fn(() => createMockQuery());
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

import { GET } from "./route";

function makeRequest(qs = "") {
  return new Request(`http://localhost/admin/pedidos/export${qs}`);
}

describe("GET /admin/pedidos/export", () => {
  beforeEach(() => {
    mockGetViewAccess.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    queryResult = { data: [], error: null };
  });

  it("devuelve 403 si no hay sesión", async () => {
    mockGetViewAccess.mockResolvedValue({ allowed: false, admin: null });
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("devuelve 403 si el admin no tiene permiso para ver pedidos", async () => {
    mockGetViewAccess.mockResolvedValue({
      allowed: false,
      admin: { id: "u1", fullName: "Vendedora", roles: [] },
    });
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("devuelve un archivo .xlsx con los pedidos cuando el admin tiene permiso", async () => {
    mockGetViewAccess.mockResolvedValue({
      allowed: true,
      admin: { id: "u1", fullName: "Admin", roles: ["SUPER_ADMIN"] },
    });
    queryResult = {
      data: [
        {
          order_number: "LB-1000",
          status: "NEW",
          total: 4500,
          created_at: "2026-01-16T15:00:00.000Z",
          customers: { first_name: "Ana", last_name: "Pérez", phone: "1122334455" },
          order_items: [{ quantity: 2 }, { quantity: 1 }],
        },
      ],
      error: null,
    };

    const response = await GET(makeRequest("?filtro=todos&fecha=todas"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toContain("pedidos.xlsx");

    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs tipa `load` con su propio alias de Buffer, que no coincide
    // estructuralmente con el Buffer<ArrayBuffer> de este @types/node.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Pedidos")!;
    const row = sheet.getRow(2).values as unknown[];
    expect(row.slice(1)).toEqual([
      "LB-1000",
      expect.any(String),
      "Ana Pérez",
      "1122334455",
      "Nuevo",
      3,
      4500,
    ]);
  });

  it("devuelve 500 si falla la consulta a la base", async () => {
    mockGetViewAccess.mockResolvedValue({
      allowed: true,
      admin: { id: "u1", fullName: "Admin", roles: ["SUPER_ADMIN"] },
    });
    queryResult = { data: null, error: { message: "boom" } };

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
  });
});
