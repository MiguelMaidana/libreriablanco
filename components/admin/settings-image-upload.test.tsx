import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

    // Set files on input manually
    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    // Dispatch submit event to trigger form submission
    form.dispatchEvent(new Event("submit", { bubbles: true }));

    // The uploadAction is called when form submits
    await waitFor(() => {
      expect(mockUploadAction).toHaveBeenCalled();
    });
  });
});
