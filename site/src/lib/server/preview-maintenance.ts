import { supabase } from "./backend";

const BUCKET = process.env.SUPABASE_BUCKET || "lead-uploads";
const LIMIT = 5;

/** Removes expired draft records and only upload objects no submitted lead uses. */
export async function cleanExpiredPreviewDrafts(): Promise<number> {
  const sb = supabase();
  if (!sb) throw new Error("Draft database unavailable");
  const { data: drafts, error } = await sb.from("preview_drafts").select("id").lt("expires_at", new Date().toISOString()).order("expires_at").limit(LIMIT);
  if (error) throw new Error(`Expired draft lookup failed: ${error.message}`);
  let cleaned = 0;
  for (const draft of drafts ?? []) {
    const { data: lead, error: leadError } = await sb.from("leads").select("id").eq("preview_draft_id", draft.id).maybeSingle();
    if (leadError) throw new Error(`Draft lead lookup failed: ${leadError.message}`);
    const referenced = new Set<string>();
    if (lead) {
      const { data: photos, error: photoError } = await sb.from("lead_photos").select("original_path,annotated_path").eq("lead_id", lead.id);
      if (photoError) throw new Error(`Draft photo lookup failed: ${photoError.message}`);
      for (const photo of photos ?? []) {
        referenced.add(photo.original_path);
        if (photo.annotated_path) referenced.add(photo.annotated_path);
      }
    }
    const root = `previews/${draft.id}`;
    const { data: batches, error: batchError } = await sb.storage.from(BUCKET).list(root, { limit: 1000 });
    if (batchError) throw new Error(`Draft storage lookup failed: ${batchError.message}`);
    // Refuse to delete a draft until every object under it has been inspected.
    if ((batches?.length ?? 0) >= 1000) continue;
    const remove: string[] = [];
    let complete = true;
    for (const batch of batches ?? []) {
      const dir = `${root}/${batch.name}`;
      const { data: objects, error: objectError } = await sb.storage.from(BUCKET).list(dir, { limit: 1000 });
      if (objectError) throw new Error(`Draft storage lookup failed: ${objectError.message}`);
      if ((objects?.length ?? 0) >= 1000) {
        complete = false;
        break;
      }
      for (const object of objects ?? []) {
        const objectPath = `${dir}/${object.name}`;
        if (!referenced.has(objectPath)) remove.push(objectPath);
      }
    }
    if (!complete) continue;
    for (let index = 0; index < remove.length; index += 1000) {
      const { error: removeError } = await sb.storage.from(BUCKET).remove(remove.slice(index, index + 1000));
      if (removeError) throw new Error(`Draft storage cleanup failed: ${removeError.message}`);
    }
    const { error: deleteError } = await sb.from("preview_drafts").delete().eq("id", draft.id).lt("expires_at", new Date().toISOString());
    if (deleteError) throw new Error(`Expired draft deletion failed: ${deleteError.message}`);
    cleaned += 1;
  }
  return cleaned;
}

/** The daily maintenance scheduler also bounds retention of hashed client counters. */
export async function cleanRateLimitBuckets(): Promise<number> {
  const sb = supabase();
  if (!sb) throw new Error("Rate limit database unavailable");
  let total = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const { data, error } = await sb.rpc("prune_rate_limit_buckets");
    if (error || typeof data !== "number") throw new Error(`Rate limit cleanup failed: ${error?.message}`);
    total += data;
    if (data < 1000) break;
  }
  return total;
}
