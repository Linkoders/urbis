const MAX_IMAGE_DIMENSION = 1600;
const TARGET_QUALITY = 0.82;

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };

    image.src = url;
  });
}

function getResizedDimensions(width: number, height: number): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= MAX_IMAGE_DIMENSION) {
    return { width, height };
  }

  const ratio = MAX_IMAGE_DIMENSION / largest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

async function compressImageFile(file: File): Promise<File> {
  if (!isImageFile(file) || file.type === "image/gif") {
    return file;
  }

  const image = await loadImage(file);
  const { width, height } = getResizedDimensions(image.width, image.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const targetType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, targetType, TARGET_QUALITY);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const extension = targetType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${extension}`, {
    type: targetType,
    lastModified: Date.now(),
  });
}

export async function uploadImageFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }

  const normalizedFiles = await Promise.all(files.map((file) => compressImageFile(file)));
  const formData = new FormData();
  for (const file of normalizedFiles) {
    formData.append("files", file);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as {
    error?: string;
    urls?: string[];
  };

  if (!response.ok) {
    throw new Error(data.error ?? "No se pudieron subir las imagenes.");
  }

  return data.urls ?? [];
}
