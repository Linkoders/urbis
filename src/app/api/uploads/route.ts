import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getBlobAccessMode, getBlobReadWriteToken, toClientAssetUrl } from "@/lib/blob-utils";

export const runtime = "nodejs";

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;
const BLOB_TOKEN = getBlobReadWriteToken();
const BLOB_ACCESS = getBlobAccessMode();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/avif") return ".avif";
  return ".jpg";
}

function buildFileName(file: File, index: number): string {
  const originalExt = extname(file.name).toLowerCase();
  const extension = originalExt || extensionFromMime(file.type);
  return `${Date.now()}-${index + 1}-${randomUUID()}${extension}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Debes subir al menos una imagen." }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Puedes subir hasta ${MAX_FILES_PER_UPLOAD} imágenes por producto.` },
        { status: 400 },
      );
    }

    if (process.env.VERCEL && !BLOB_TOKEN) {
      return NextResponse.json(
        { error: "Falta configurar BLOB_READ_WRITE_TOKEN en el entorno." },
        { status: 500 },
      );
    }

    const useBlob = Boolean(BLOB_TOKEN);
    if (!useBlob) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }

    const urls: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `Formato no permitido: ${file.type || "desconocido"}` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `La imagen ${file.name} supera el límite de 5MB.` },
          { status: 400 },
        );
      }

      const fileName = buildFileName(file, index);

      if (useBlob) {
        const blob = await put(`urbis/${fileName}`, file, {
          access: BLOB_ACCESS,
          token: BLOB_TOKEN,
          addRandomSuffix: false,
        });
        urls.push(toClientAssetUrl(blob.url));
        continue;
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const destination = join(UPLOADS_DIR, fileName);
      await writeFile(destination, fileBuffer);
      urls.push(`/uploads/${fileName}`);
    }

    return NextResponse.json({ ok: true, urls });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido.";
    console.error("[/api/uploads] Error al subir imágenes:", error);

    const privateStoreAccessMismatch =
      detail.includes("Cannot use public access on a private store") &&
      BLOB_ACCESS === "public";

    return NextResponse.json(
      {
        error: privateStoreAccessMismatch
          ? "El Blob Store es privado y el API está en modo público. Configura BLOB_ACCESS=private o cambia el store a Public en Vercel."
          : process.env.NODE_ENV === "development"
            ? `No se pudieron subir las imágenes. ${detail}`
            : "No se pudieron subir las imágenes.",
      },
      { status: 500 },
    );
  }
}
