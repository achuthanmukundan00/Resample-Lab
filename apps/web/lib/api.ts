import {
  Capabilities,
  PackCreateResponse,
  PackListResponse,
  PackStatusResponse,
} from "@/lib/types";

// Static export — no backend. This API client is unused in the local-only flow.
// Calls will fail and callers should handle errors gracefully.
const API_BASE = typeof window === "undefined" ? "" : window.location.origin;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export const api = {
  async getCapabilities(): Promise<Capabilities> {
    const res = await fetch(`${API_BASE}/api/capabilities`);
    return handleResponse<Capabilities>(res);
  },

  async createPack(
    files: File[],
    preset: string,
    chaos: number,
    outputFormat: string,
    packName: string,
  ): Promise<PackCreateResponse> {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("preset", preset);
    formData.append("chaos", String(chaos));
    formData.append("output_format", outputFormat);
    formData.append("pack_name", packName);

    const res = await fetch(`${API_BASE}/api/packs`, {
      method: "POST",
      body: formData,
    });
    return handleResponse<PackCreateResponse>(res);
  },

  async getPackStatus(packId: string): Promise<PackStatusResponse> {
    const res = await fetch(`${API_BASE}/api/packs/${packId}`);
    return handleResponse<PackStatusResponse>(res);
  },

  async downloadPack(packId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/packs/${packId}/download`);
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {}
      throw new ApiError(detail, res.status);
    }
    const blob = await res.blob();
    if (blob.size < 100) {
      throw new ApiError(
        `Download returned unexpectedly small response (${blob.size} bytes)`,
        res.status,
      );
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
      if (blob.size < 512) {
        const text = await blob.text();
        throw new ApiError(
          `Unexpected response: ${text.slice(0, 200)}`,
          res.status,
        );
      }
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match?.[1] || `resample-lab-${packId.slice(0, 8)}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async listPacks(status?: string): Promise<PackListResponse> {
    const params = status ? `?status=${status}` : "";
    const res = await fetch(`${API_BASE}/api/packs${params}`);
    return handleResponse<PackListResponse>(res);
  },

  async deletePack(packId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/packs/${packId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {}
      throw new ApiError(detail, res.status);
    }
  },
};
