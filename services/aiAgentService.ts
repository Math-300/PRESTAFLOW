import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { Client, Transaction } from "../types";

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
export class AIAgentService {
    private geminiClient: GoogleGenerativeAI | null = null;
    private openai: OpenAI | null = null;
    private systemPrompt: string;
    private agentName: string;
    private provider: AIProvider;

    constructor(apiKey: string, systemPrompt: string, agentName: string, provider: AIProvider = 'GEMINI') {
        this.systemPrompt = systemPrompt;
        this.agentName = agentName;
        this.provider = provider;

        if (provider === 'GEMINI') {
            this.geminiClient = new GoogleGenerativeAI(apiKey);
        } else if (provider === 'OPENAI') {
            this.openai = new OpenAI({
                apiKey,
                dangerouslyAllowBrowser: true
            });
        }
    }

    async sendMessage(
        history: ChatMessage[],
        newMessage: string,
        contextData?: string
    ): Promise<ChatMessage> {
        const fullSystemPrompt = `${this.systemPrompt}\n\nTu nombre es ${this.agentName}.\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n${contextData || 'Sin contexto adicional.'}`;

        try {
            // --- BLOQUE GEMINI ---
            if (this.provider === 'GEMINI' && this.geminiClient) {
                const model = this.geminiClient.getGenerativeModel({
                    model: "gemini-3.0-flash-001", // gemini-2.0-flash es el más actual, usamos 1.5-flash por estabilidad o el que prefieras
                    systemInstruction: fullSystemPrompt,
                });

                const chat = model.startChat({
                    history: history
                        .filter(h => h.role !== 'system')
                        .map(h => ({
                            role: h.role === 'model' ? 'model' : 'user',
                            parts: [{ text: h.content }]
                        })),
                    generationConfig: {
                        maxOutputTokens: 500,
                        temperature: 0.7,
                    },
                });

                const result = await chat.sendMessage(newMessage);
                const response = result.response;

                return { role: 'model', content: response.text() };
            }

            // --- BLOQUE OPENAI ---
            if (this.provider === 'OPENAI' && this.openai) {
                const messages: any[] = [
                    { role: 'system', content: fullSystemPrompt },
                    ...history.map(h => ({
                        role: h.role === 'model' ? 'assistant' : 'user',
                        content: h.content
                    })),
                    { role: 'user', content: newMessage }
                ];

                const response = await this.openai.chat.completions.create({
                    model: "gpt-4.1-mini", // gpt-4o-mini es el reemplazo robusto y económico de gpt-3.5/4-turbo
                    messages: messages,
                    max_tokens: 500,
                    temperature: 0.7,
                });

                return {
                    role: 'model',
                    content: response.choices[0].message.content || "Sin respuesta de OpenAI."
                };
            }

            return { role: 'model', content: "Proveedor no configurado correctamente." };

        } catch (error: any) {
            console.error(`AI Agent Error (${this.provider}):`, error);

            if (error?.status === 401 || error?.error?.code === 401) {
                return { role: 'model', content: "Error de autenticación: API Key inválida." };
            }
            if (error?.status === 429) {
                return { role: 'model', content: "Error: Demasiadas peticiones (Rate Limit). Intenta en unos segundos." };
            }

            return { role: 'model', content: `Ocurrió un error procesando tu solicitud con ${this.provider}.` };
        }
    }
}
