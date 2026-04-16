export async function uploadImageFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }

  const formData = new FormData();
  for (const file of files) {
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
    throw new Error(data.error ?? "No se pudieron subir las imágenes.");
  }

  return data.urls ?? [];
}
