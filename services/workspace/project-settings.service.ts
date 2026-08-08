import { supabase } from "@/lib/supabase";

export async function saveSelectedMoodboard(
  projectId: string,
  index: number
) {
  const { error } = await supabase
    .from("project_settings")
    .upsert({
      project_id: projectId,
      selected_moodboard: index,
    });

  if (error) throw error;
}

export async function getProjectSettings(projectId: string) {
  const { data } = await supabase
    .from("project_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  return data;
}