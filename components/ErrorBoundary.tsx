
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-slate-50 p-6">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border-t-4 border-red-500">
                        <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
                            <AlertTriangle size={48} className="text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Algo salió mal</h2>
                        <p className="text-slate-600 mb-6">
                            La aplicación ha encontrado un error inesperado. Hemos registrado este evento.
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-100 p-4 rounded text-left text-xs font-mono text-slate-500 mb-6 overflow-auto max-h-32">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 w-full transition-colors"
                        >
                            <RefreshCw size={20} /> Reiniciar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
