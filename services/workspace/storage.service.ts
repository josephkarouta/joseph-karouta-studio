import { supabase } from "@/lib/supabase";

function base64ToBlob(base64: string) {
  const parts = base64.split(",");
  const contentType = parts[0].match(/:(.*?);/)?.[1] || "image/png";
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }

  return new Blob([array], { type: contentType });
}

export async function uploadBase64ProjectAsset({
  userId,
  projectId,
  fileName,
  base64,
}: {
  userId: string;
  projectId: string;
  fileName: string;
  base64: string;
}) {
  const blob = base64ToBlob(base64);

  const path = `${userId}/${projectId}/${fileName}`;

  const { error } = await supabase.storage
    .from("project-assets")
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("project-assets")
    .getPublicUrl(path);

  return data.publicUrl;
}