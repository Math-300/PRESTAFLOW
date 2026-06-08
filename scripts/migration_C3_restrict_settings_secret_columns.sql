-- ============================================================================
-- C3/C2: Las API keys de IA dejan de exponerse al cliente.
--
-- Parte 1 (código): Edge Function `supabase/functions/ai-chat/index.ts` actúa
-- como proxy server-side; el frontend ya no instancia SDKs ni recibe la key.
--
-- Parte 2 (esta migración): restringir la lectura de las columnas secretas de
-- `settings` para que NINGÚN miembro pueda leerlas por la Data API. La tabla
-- tiene columnas duplicadas camelCase+snake_case; las secretas son:
--   "apiKey", api_key, ai_api_key
-- ============================================================================

revoke select on public.settings from authenticated;
revoke select on public.settings from anon;

grant select (
  id, organization_id,
  "companyName", company_name,
  "defaultInterestRate", default_interest_rate,
  "useOpenAI", use_openai,
  "n8nWebhookUrl", n8n_webhook_url,
  max_card_limit, ui_config,
  ai_provider, ai_agent_name, ai_system_prompt
) on public.settings to authenticated;

-- INSERT/UPDATE siguen a nivel de tabla => un admin puede escribir las keys
-- (write-only) pero nadie puede leerlas. La Edge Function ai-chat las lee con
-- service_role, que ignora estos grants de columna.
