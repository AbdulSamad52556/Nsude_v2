// Browser-side helpers for the admin API.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {}
  ) {
    super(message);
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session expired: send the admin back to login, then here.
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", res.status, data.fields);
  return data as T;
}

export interface UploadedImage {
  src: string;
  publicId: string;
  width: number;
  height: number;
}

export async function uploadImage(file: File, folder: "products" | "hero") {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Upload failed", res.status);
  return data.image as UploadedImage;
}

/** Import a remote image by URL; it's copied into Cloudinary. */
export async function uploadImageFromUrl(url: string, folder: "products" | "hero") {
  const data = await apiFetch<{ image: UploadedImage }>("/api/admin/upload", {
    method: "POST",
    body: JSON.stringify({ url, folder }),
  });
  return data.image;
}
