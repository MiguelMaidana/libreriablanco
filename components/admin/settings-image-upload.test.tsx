import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { SettingsImageUpload } from "./settings-image-upload";

describe("SettingsImageUpload", () => {
  const mockUploadAction = vi.fn();

  beforeEach(() => {
    mockUploadAction.mockReset();
  });

  it("muestra la imagen actual cuando currentUrl está definido", () => {
    render(
      <SettingsImageUpload
        label="Logo"
        currentUrl="https://example.com/logo.png"
        uploadAction={mockUploadAction}
      />,
    );
    expect(screen.getByAltText("Logo")).toBeInTheDocument();
  });

  it("no muestra ninguna imagen cuando currentUrl es null", () => {
    render(<SettingsImageUpload label="Logo" currentUrl={null} uploadAction={mockUploadAction} />);
    expect(screen.queryByAltText("Logo")).not.toBeInTheDocument();
  });

  it("llama a uploadAction al subir un archivo", async () => {
    mockUploadAction.mockResolvedValue({ error: null });
    render(<SettingsImageUpload label="Logo" currentUrl={null} uploadAction={mockUploadAction} />);

    const input = screen.getByLabelText("Subir logo") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    // Dispatch submit event to trigger form submission (matches real browser behavior)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    // Verify uploadAction was called via form submission with the expected shape
    await waitFor(() => {
      expect(mockUploadAction).toHaveBeenCalledWith({ error: null }, expect.any(FormData));
    });
  });

  it("muestra un error con toast.error cuando uploadAction falla", async () => {
    mockUploadAction.mockResolvedValue({ error: "algo salió mal" });
    render(<SettingsImageUpload label="Logo" currentUrl={null} uploadAction={mockUploadAction} />);

    const input = screen.getByLabelText("Subir logo") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("algo salió mal");
    });
  });
});
