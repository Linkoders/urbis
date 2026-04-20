const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";
const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export function getBlobReadWriteToken(): string {
  return (
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.URBIS_READ_WRITE_TOKEN?.trim() ||
    process.env.urbis_READ_WRITE_TOKEN?.trim() ||
    ""
  );
}

export function getBlobAccessMode(): "public" | "private" {
  return process.env.BLOB_ACCESS?.trim().toLowerCase() === "public"
    ? "public"
    : "private";
}

export function isBlobStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function isPrivateBlobStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

export function toBlobProxyUrl(value: string): string {
  if (!value || value.startsWith("/api/blob?")) {
    return value;
  }

  return `/api/blob?url=${encodeURIComponent(value)}`;
}

export function toClientAssetUrl(value: string): string {
  if (!value) {
    return value;
  }

  if (isPrivateBlobStorageUrl(value)) {
    return toBlobProxyUrl(value);
  }

  return value;
}
