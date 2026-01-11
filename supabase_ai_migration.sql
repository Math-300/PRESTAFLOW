-- MIGRATION: Update Settings Table for PrestaFlow Pro
-- Run this in your Supabase SQL Editor to enable AI and new configuration features.

-- 1. Create fields if they don't exist (using IF NOT EXISTS to be safe)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_interest_rate NUMERIC DEFAULT 5;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS use_openai BOOLEAN DEFAULT FALSE;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS max_card_limit NUMERIC DEFAULT 500;

-- 2. AI Specific Fields
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'GEMINI'; -- 'GEMINI', 'OPENAI', etc.
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ai_agent_name TEXT DEFAULT 'LuchoBot';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;

-- 3. Policy to allow organization access
CREATE POLICY "Enable access for users based on organization_id" ON "public"."settings"
AS PERMISSIVE FOR ALL
TO public
USING (auth.uid() IN (
  SELECT user_id FROM organization_members WHERE organization_id = settings.organization_id
))
WITH CHECK (auth.uid() IN (
  SELECT user_id FROM organization_members WHERE organization_id = settings.organization_id
));
