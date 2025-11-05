import { supabase } from "../../lib/_supabase.js";
import { hashDeviceId } from "../../lib/_crypto.js";
import { readJson } from "../../lib/_readJson.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { deviceId } = await readJson(req);
    if (!deviceId) return res.status(400).json({ ok:false, allowTrial:false, reason:"no_device" });

    const deviceHash = hashDeviceId(deviceId);

    const { data } = await supabase
      .from("licenses")
      .select("id")
      .eq("device_id_hash", deviceHash)
      .eq("trial_used", true)
      .limit(1);

    if (data?.length) return res.json({ ok:false, allowTrial:false, reason:"trial_already_used" });
    return res.json({ ok:true, allowTrial:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, allowTrial:false, reason:"server_error" });
  }
}

