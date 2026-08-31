import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockGetCurrentAdmin } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetCurrentAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getCurrentAdmin: mockGetCurrentAdmin,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

import ProtectedAdminLayout from "./layout";

describe("ProtectedAdminLayout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetCurrentAdmin.mockReset();
  });

  it("redirige a /admin/login si no hay sesión", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(
      ProtectedAdminLayout({ children: <div /> }),
    ).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("redirige a /admin/unauthorized si hay sesión pero no hay admin activo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCurrentAdmin.mockResolvedValue(null);

    await expect(
      ProtectedAdminLayout({ children: <div /> }),
    ).rejects.toThrow("REDIRECT:/admin/unauthorized");
  });

  it("renderiza los children si hay sesión y admin activo", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCurrentAdmin.mockResolvedValue({ id: "u1", fullName: "Test", roles: [] });

    const result = await ProtectedAdminLayout({
      children: <div data-testid="child" />,
    });
    expect(result).toBeTruthy();
  });
});
