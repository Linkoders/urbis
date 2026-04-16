import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";

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
          access: "public",
          token: BLOB_TOKEN,
          addRandomSuffix: false,
        });
        urls.push(blob.url);
        continue;
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const destination = join(UPLOADS_DIR, fileName);
      await writeFile(destination, fileBuffer);
      urls.push(`/uploads/${fileName}`);
    }

    return NextResponse.json({ ok: true, urls });
  } catch {
    return NextResponse.json({ error: "No se pudieron subir las imágenes." }, { status: 500 });
  }
}
