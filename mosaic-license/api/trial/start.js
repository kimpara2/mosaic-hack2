// /api/trial/start.js  ← この1ファイルだけで動作
export const config = { runtime: "nodejs20.x" }; // Edge回避（Nodeのreq/resを使う）

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ==== 環境変数必須 ====
// Vercelの Project Settings → Environment Variables に設定してあるか確認
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LICENSE_SIGNING_SECRET } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LICENSE_SIGNING_SECRET) {
  console.error("ENV MISSING", { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY, LICENSE_SIGNING_SECRET: !!LICENSE_SIGNING_SECRET });
}

// Supabaseクライアント（ここで生成：相対パス不整合を排除）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function hmac(v) {
  return crypto.createHmac("sha256", LICENSE_SIGNING_SECRET).update(String(v)).digest("hex");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(b || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { deviceId } = await readJson(req);
    if (!deviceId) return res.status(400).json({ ok: false, allowTrial: false, reason: "no_device" });

    const deviceHash = hmac(deviceId);

    const { data, error } = await supabase
      .from("licenses")
      .select("id")
      .eq("device_id_hash", deviceHash)
      .eq("trial_used", true)
      .limit(1);

    if (error) {
      console.error("SUPABASE_ERROR", error);
      return res.status(500).json({ ok: false, allowTrial: false, reason: "db_error" });
    }

    if (data && data.length) {
      return res.json({ ok: false, allowTrial: false, reason: "trial_already_used" });
    }

    return res.json({ ok: true, allowTrial: true });
  } catch (e) {
    console.error("HANDLER_ERROR", e);
    return res.status(500).json({ ok: false, allowTrial: false, reason: "server_error" });
  }
}

