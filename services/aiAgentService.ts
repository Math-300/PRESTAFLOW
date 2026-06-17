import { supabase } from "../lib/supabaseClient";

// --- TYPES ---
export interface AIAction {
    tool: 'get_client_info' | 'get_client_transactions' | 'register_payment_promise' | 'escalate_case';
    parameters: any;
    rationale: string;
}

export type MessageRole = 'user' | 'model' | 'system';

export interface ChatMessage {
    role: MessageRole;
    content: string;
    action?: AIAction;
}

export type AIProvider = 'GEMINI' | 'SUPABASE' | 'OPENAI';

const AI_TIMEOUT_MS = 30_000;

// --- SERVICE ---
// SEGURIDAD: este servicio ya NO recibe ni maneja la API key. Toda la llamada a
// la IA pasa por la Edge Function `ai-chat`, que guarda la key server-side.
export class AIAgentService {
    private organizationId: string;
    private agentName: string;

    constructor(organizationId: string, agentName: string = 'Asistente') {
        this.organizationId = organizationId;
        this.agentName = agentName;
    }

    async sendMessage(
        history: ChatMessage[],
        newMessage: string,
        contextData?: string
    ): Promise<ChatMessage> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        try {
            // Obtenemos la sesión actual para incluir el token de auth en el fetch nativo.
            // Usamos fetch directo para poder pasar `signal` al AbortController.
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token ?? '';

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

            const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    organizationId: this.organizationId,
                    history: history.filter(h => h.role !== 'system'),
                    message: newMessage,
                    context: contextData,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                console.error('AI Agent HTTP error:', res.status, text);
                throw new Error('No se pudo contactar al asistente. Intenta de nuevo.');
            }

            const data = await res.json();
            return {
                role: 'model',
                content: (data && data.content) ? data.content : 'Sin respuesta del asistente.',
            };
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new Error('La IA tardó demasiado en responder. Intenta de nuevo.');
            }
            // Re-lanzamos para que el caller (handleSend) lo capture y actualice la UI.
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }
}
