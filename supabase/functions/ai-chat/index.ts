// ============================================================================
// Edge Function: ai-chat
// Proxy seguro para el asistente de IA. La API key del proveedor (Gemini/OpenAI)
// vive en `settings` (por organización) y SOLO se usa aquí, server-side. El
// navegador nunca la recibe. Resuelve C2 (key legible por miembros) y C3 (key
// en el navegador / dangerouslyAllowBrowser).
//
// Flujo:
//   1. Verifica el JWT del usuario (debe estar autenticado).
//   2. Verifica que el usuario es miembro de la organización y tiene el permiso
//      `use_ai` (modelo opt-out, igual que el resto de la app).
//   3. Lee la key de la org con service_role y llama al proveedor por REST.
//   4. Devuelve solo el texto de la respuesta.
// ============================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Orígenes permitidos. Configurable vía secreto ALLOWED_ORIGINS (coma-separado).
// Por defecto refleja el origen del request (apto para apps SPA con JWT en header,
// no usa cookies). Para producción, fija tu dominio en ALLOWED_ORIGINS.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = "*";
  if (ALLOWED_ORIGINS.length > 0) {
    allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  } else if (origin) {
    allow = origin;
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface ChatMessage { role: "user" | "model" | "system"; content: string; }

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function callGemini(apiKey: string, system: string, history: ChatMessage[], message: string): Promise<string> {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const contents = history
    .filter((h) => h.role !== "system")
    .map((h) => ({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.content }] }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sin respuesta.";
}

async function callOpenAI(apiKey: string, system: string, history: ChatMessage[], message: string): Promise<string> {
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const messages = [
    { role: "system", content: system },
    ...history.map((h) => ({ role: h.role === "model" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 500, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "Sin respuesta.";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  // 1. Autenticación: el JWT del usuario llega en Authorization.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401, origin);

  let body: { organizationId?: string; history?: ChatMessage[]; message?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }
  const { organizationId, history = [], message, context } = body;
  if (!organizationId || !message) return json({ error: "missing_fields" }, 400, origin);

  // 2. Autorización con service_role (la key nunca toca al cliente).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: member } = await admin
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return json({ error: "forbidden" }, 403, origin);

  let allowed = member.role === "owner" || member.role === "admin";
  if (!allowed) {
    const { data: perm } = await admin
      .from("member_permissions")
      .select("is_enabled")
      .eq("member_id", member.id)
      .eq("permission_slug", "use_ai")
      .maybeSingle();
    allowed = !perm || perm.is_enabled === true; // opt-out: por defecto permitido
  }
  if (!allowed) return json({ error: "forbidden" }, 403, origin);

  // 2b. Rate limiting por usuario/minuto (protege costos de la API de IA).
  const rateLimit = Number(Deno.env.get("AI_RATE_LIMIT") || "20");
  const { data: withinLimit } = await admin.rpc("bump_ai_usage", { p_user: user.id, p_limit: rateLimit });
  if (withinLimit === false) {
    return json({ role: "model", content: "Has alcanzado el límite de mensajes por minuto. Espera un momento e intenta de nuevo." }, 200, origin);
  }

  // 3. Leer configuración + key de la organización.
  const { data: st } = await admin
    .from("settings")
    .select("ai_api_key, api_key, ai_provider, ai_system_prompt, ai_agent_name")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const apiKey = (st?.ai_api_key || st?.api_key || "").trim();
  if (!apiKey) {
    return json({ role: "model", content: "La IA no está configurada. Pide a un administrador que agregue la API Key en Configuración." }, 200, origin);
  }

  const provider = (st?.ai_provider || "GEMINI").toUpperCase();
  const agentName = st?.ai_agent_name || "Asistente";
  const basePrompt = st?.ai_system_prompt || "Eres un asistente útil para un negocio de préstamos.";
  const system = `${basePrompt}\n\nTu nombre es ${agentName}.\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n${context || "Sin contexto adicional."}`;

  // 4. Llamar al proveedor.
  try {
    const content = provider === "OPENAI"
      ? await callOpenAI(apiKey, system, history, message)
      : await callGemini(apiKey, system, history, message);
    return json({ role: "model", content }, 200, origin);
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (msg.endsWith("_401") || msg.endsWith("_403")) {
      return json({ role: "model", content: "Error de autenticación con el proveedor de IA: API Key inválida." }, 200, origin);
    }
    if (msg.endsWith("_429")) {
      return json({ role: "model", content: "Demasiadas peticiones a la IA. Intenta en unos segundos." }, 200, origin);
    }
    return json({ role: "model", content: "Ocurrió un error procesando tu solicitud con la IA." }, 200, origin);
  }
});
