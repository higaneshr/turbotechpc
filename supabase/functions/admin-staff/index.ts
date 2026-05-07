import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "create_technician") {
      const { email, password, full_name, phone } = body;
      if (!email || !password || !full_name) return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name, phone },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
      // Profile is created by trigger; ensure role
      await admin.from("user_roles").insert({ user_id: created.user!.id, role: "technician" });
      await admin.from("profiles").upsert({ id: created.user!.id, full_name, phone });
      return new Response(JSON.stringify({ ok: true, user_id: created.user!.id }), { headers: { ...cors, "content-type": "application/json" } });
    }

    if (action === "remove_technician") {
      const { user_id } = body;
      await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "technician");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
