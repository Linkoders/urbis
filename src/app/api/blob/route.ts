import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import {
  getBlobReadWriteToken,
  isBlobStorageUrl,
  isPrivateBlobStorageUrl,
} from "@/lib/blob-utils";

export const runtime = "nodejs";

const BLOB_TOKEN = getBlobReadWriteToken();

export async function GET(request: NextRequest) {
  const blobUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!blobUrl) {
    return NextResponse.json({ error: "Falta el parámetro url." }, { status: 400 });
  }

  if (!isBlobStorageUrl(blobUrl)) {
    return NextResponse.json({ error: "URL de Blob inválida." }, { status: 400 });
  }

  const isPrivate = isPrivateBlobStorageUrl(blobUrl);
  if (!isPrivate) {
    return NextResponse.redirect(blobUrl, { status: 307 });
  }

  if (!BLOB_TOKEN) {
    return NextResponse.json(
      { error: "Falta token para acceder a Blob privado." },
      { status: 500 },
    );
  }

  try {
    const result = await get(blobUrl, {
      access: "private",
      token: BLOB_TOKEN,
      useCache: true,
    });

    if (!result) {
      return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    }

    if (result.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, max-age=120",
        },
      });
    }

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType,
        "Content-Disposition": result.blob.contentDisposition,
        "Cache-Control": "private, max-age=120",
        ETag: result.blob.etag,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener el archivo." }, { status: 500 });
  }
}
