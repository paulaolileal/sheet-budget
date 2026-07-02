const DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export class DriveApiClient {
  constructor(private readonly getAccessToken: () => string | null) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getAccessToken();
    if (!token) throw new Error("Sem token Google — faça login novamente.");
    const res = await fetch(`${DRIVE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async listSpreadsheets(name: string): Promise<DriveFile[]> {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.spreadsheet' and name='${name}' and trashed=false`,
    );
    const data = await this.request<{ files: DriveFile[] }>(
      `/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc`,
    );
    return data.files ?? [];
  }

  async getOrCreateFolder(name: string): Promise<string> {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`,
    );
    const search = await this.request<{ files: { id: string }[] }>(
      `/files?q=${q}&fields=files(id)`,
    );
    if (search.files.length > 0) return search.files[0].id;

    const folder = await this.request<{ id: string }>("/files", {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    return folder.id;
  }

  async moveToFolder(fileId: string, folderId: string): Promise<void> {
    const file = await this.request<{ parents?: string[] }>(`/files/${fileId}?fields=parents`);
    const currentParents = file.parents ?? [];
    if (currentParents.includes(folderId)) return;
    const removeParents = encodeURIComponent(currentParents.join(","));
    await this.request(
      `/files/${fileId}?addParents=${folderId}&removeParents=${removeParents}&fields=id`,
      { method: "PATCH", body: JSON.stringify({}) },
    );
  }
}
