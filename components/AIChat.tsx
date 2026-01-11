
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Client, Transaction } from '../types';
import { AIAgentService, ChatMessage } from '../services/aiAgentService';
import { useData } from '../contexts/DataContext';

interface AIChatProps {
  activeClient: Client | null;
  transactions: Transaction[];
}

export const AIChat: React.FC<AIChatProps> = ({ activeClient, transactions }) => {
  const { settings } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const agentRef = useRef<AIAgentService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FEATURE FLAG: Logic moved to return

  // Initialize Agent Logic
  useEffect(() => {
    if (settings.aiApiKey) {
      const systemPrompt = settings.aiSystemPrompt || "Eres un asistente útil.";
      const agentName = settings.aiAgentName || "LuchoBot";
      const provider = settings.aiProvider || 'GEMINI';
      agentRef.current = new AIAgentService(settings.aiApiKey, systemPrompt, agentName, provider);

      setMessages([{
        role: 'model',
        content: activeClient
          ? `Hola, soy ${agentName}. Estoy revisando el historial de ${activeClient.name}.`
          : `Hola, soy ${agentName}. Sistema listo para consultas y gestión.`
      }]);
    }
  }, [settings.aiApiKey, settings.aiSystemPrompt, settings.aiAgentName, settings.aiProvider, activeClient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !agentRef.current) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      // Build Context (RAG Simple)
      let context = "";
      if (activeClient) {
        context += `CLIENTE ACTUAL: ${activeClient.name} (ID: ${activeClient.id})\n`;
        context += `Saldo: ${transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : 0}\n`;
        context += `Estado: ${activeClient.status}\n`;
        context += `Notas: ${activeClient.notes}\n`;
        context += `Últimas Tx: ${JSON.stringify(transactions.slice(-5))}`;
      } else {
        context += "No hay cliente seleccionado. El usuario está en el dashboard general.";
      }

      const response = await agentRef.current.sendMessage(messages, userMsg, context);
      setMessages(prev => [...prev, response]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: 'Lo siento, error comunicando con el cerebro central.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!settings.useOpenAI) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed z-50 flex items-center gap-2 group transition-all hover:scale-105 active:scale-95 bg-slate-900 text-white p-3 md:p-4 rounded-full shadow-2xl hover:bg-slate-800"
          style={{
            bottom: 'calc(80px + var(--safe-area-bottom))',
            right: '1rem'
          }}
        >
          <Bot className="w-6 h-6" />
          <span className="font-black pr-1 md:pr-2 text-xs md:text-base uppercase tracking-tight">{settings.aiAgentName || 'Asistente'}</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 w-full h-[90vh] md:bottom-6 md:right-6 md:w-96 md:h-[600px] bg-white md:rounded-2xl rounded-t-[32px] shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
          style={{ paddingBottom: 'var(--safe-area-bottom)' }}
        >

          {/* Header */}
          <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-slate-800 overflow-hidden">
                <img src="/icon-light.png" alt="AI" className="w-7 h-7 object-contain" />
              </div>

              <div className="leading-tight">
                <h3 className="font-bold text-sm">{settings.aiAgentName || 'LuchoBot'}</h3>
                <p className="text-[10px] text-blue-200 flex items-center gap-1">
                  <ShieldAlert size={10} /> Agente Autorizado
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-slate-700 p-1 rounded transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scrollbar-thin">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                      }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 pb-6 md:pb-3">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={!settings.aiApiKey ? "Configura tu API Key primero..." : "Escribe un mensaje..."}
                disabled={!settings.aiApiKey || isTyping}
                className="flex-1 bg-slate-100 border-0 rounded-2xl pl-4 pr-12 py-3.5 text-base md:text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-1 top-1 h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-0 disabled:scale-90 shadow-md active:scale-90"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
