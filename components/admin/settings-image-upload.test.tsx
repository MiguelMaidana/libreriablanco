import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

    const file = new File(["x"], "logo.png", { type: "image/png" });
    const input = screen.getByLabelText("Subir logo") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;

    // Manually set files on input
    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    // Dispatch submit event to trigger form submission (matches real browser behavior)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    // Verify uploadAction was called via form submission
    await waitFor(() => {
      expect(mockUploadAction).toHaveBeenCalled();
    });
  });
});
