
import React, { useState, ReactNode } from 'react';
import { Trash2, Edit2 } from 'lucide-react';

interface SwipeableItemProps {
    children: ReactNode;
    onDelete?: () => void;
    onEdit?: () => void;
    threshold?: number;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({ children, onDelete, onEdit, threshold = 80 }) => {
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const onTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;

        // Resistance logic for a professional feel
        if (Math.abs(dx) > threshold * 1.5) {
            setCurrentX(dx * 0.5); // Dampening
        } else {
            setCurrentX(dx);
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        if (currentX < -threshold && onDelete) {
            if ('vibrate' in navigator) navigator.vibrate(50); // Haptic feedback
            onDelete();
        } else if (currentX > threshold && onEdit) {
            if ('vibrate' in navigator) navigator.vibrate(50);
            onEdit();
        }
        setCurrentX(0);
    };

    return (
        <div className="relative overflow-hidden w-full touch-pan-y">
            {/* Background Actions */}
            <div className="absolute inset-0 flex justify-between items-center px-6">
                <div className={`flex items-center gap-2 text-blue-600 transition-opacity ${currentX > 20 ? 'opacity-100' : 'opacity-0'}`}>
                    <Edit2 size={24} />
                    <span className="font-black text-xs uppercase tracking-tighter">Editar</span>
                </div>
                <div className={`flex items-center gap-2 text-red-600 transition-opacity ${currentX < -20 ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="font-black text-xs uppercase tracking-tighter">Eliminar</span>
                    <Trash2 size={24} />
                </div>
            </div>

            {/* Content wrapper */}
            <div
                className={`relative z-10 bg-transparent transition-transform duration-200 ease-out`}
                style={{ transform: `translateX(${currentX}px)` }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {children}
            </div>
        </div>
    );
};
