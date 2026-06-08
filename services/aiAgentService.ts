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
        try {
            const { data, error } = await supabase.functions.invoke('ai-chat', {
                body: {
                    organizationId: this.organizationId,
                    history: history.filter(h => h.role !== 'system'),
                    message: newMessage,
                    context: contextData,
                },
            });

            if (error) {
                console.error('AI Agent invoke error:', error);
                return { role: 'model', content: 'No se pudo contactar al asistente. Intenta de nuevo.' };
            }

            return {
                role: 'model',
                content: (data && data.content) ? data.content : 'Sin respuesta del asistente.',
            };
        } catch (err) {
            console.error('AI Agent Error:', err);
            return { role: 'model', content: 'Ocurrió un error procesando tu solicitud.' };
        }
    }
}
