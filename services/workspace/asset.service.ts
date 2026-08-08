import { supabase } from "@/lib/supabase";

export async function getProjectAssets(projectId: string) {
  const { data, error } = await supabase
    .from("project_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createProjectAsset(asset: any) {
  const { data, error } = await supabase
    .from("project_assets")
    .insert(asset)
    .select()
    .single();

  if (error) throw error;

  return data;
}