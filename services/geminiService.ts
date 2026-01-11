
import { GoogleGenAI } from "@google/genai";
import { Client, Transaction } from "../types";

// Acceso directo a variables de entorno de Vite
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;

// Initialize only if key exists to avoid immediate errors
const ai = API_KEY && API_KEY !== 'tu-clave-ai-aqui' ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Helper to format currency for the AI context
const fmt = (num: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);

export const createChatSession = (client: Client | null, transactions: Transaction[]) => {
  if (!ai) {
    console.warn("Gemini API Key missing. Chat features disabled.");
    return null;
  }

  let systemContext = `
    Eres "PrestaFlow AI", un auditor financiero experto y asistente operativo para un negocio de préstamos.
    Tu objetivo es analizar datos numéricos y dar respuestas concisas, profesionales y estratégicas.
    
    REGLAS:
    1. NO des consejos legales vinculantes.
    2. Enfócate en la salud de la cartera y el riesgo crediticio.
    3. Si detectas patrones de mora, sugiere planes de pago amigables.
    4. Usa formato moneda COP para valores monetarios.
  `;

  if (client) {
    // Optimize history: limit to last 15 meaningful transactions to save tokens
    const history = transactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-15)
      .map(t =>
        `[${t.date}] ${t.type}: ${fmt(t.amount)} (Interés: ${fmt(t.interestPaid)}) -> Saldo Nuevo: ${fmt(t.balanceAfter)}`
      ).join('\n');

    const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : 0;

    // Calculate metrics
    const totalInterest = transactions.reduce((acc, t) => acc + t.interestPaid, 0);
    const daysActive = Math.floor((Date.now() - new Date(client.creditStartDate).getTime()) / (1000 * 60 * 60 * 24));

    // Risk Analysis Data
    const latePayments = transactions.filter(t => t.type === 'PAYMENT_CAPITAL' && t.notes?.toLowerCase().includes('mora')).length;

    systemContext += `
      DATOS DEL CLIENTE:
      - Nombre: ${client.name}
      - ID: ${client.cedula}
      - Ocupación: ${client.occupation || 'N/A'}
      - Estado: ${client.status}
      - Días activo: ${daysActive}
      - Saldo Actual: ${fmt(currentBalance)}
      - Total Intereses Generados: ${fmt(totalInterest)}
      
      HISTORIAL RECIENTE:
      ${history}
      
      ANÁLISIS DE RIESGO:
      El cliente tiene ${latePayments} pagos registrados con notas de mora.
    `;
  } else {
    systemContext += `
      CONTEXTO GENERAL:
      Estás en el Dashboard Principal.
      Ayuda al usuario a redactar mensajes de cobro masivos, analizar la liquidez general o crear estrategias de fidelización.
    `;
  }

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemContext,
    },
  });
};
