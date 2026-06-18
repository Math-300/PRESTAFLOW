
import React, { useState, ReactNode, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
    children: ReactNode;
    onRefresh: () => Promise<void>;
}

/**
 * Sube por el árbol DOM desde `node` hasta encontrar el primer ancestro
 * cuyo overflow-y computado sea "auto" o "scroll" Y que tenga contenido
 * desplazable (scrollHeight > clientHeight). Devuelve ese elemento o null.
 */
function findScrollableAncestor(node: HTMLElement | null): HTMLElement | null {
    let el = node?.parentElement ?? null;
    while (el && el !== document.body) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, onRefresh }) => {
    const [pullOffset, setPullOffset] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const isDragging = useRef(false);
    const threshold = 80;
    const rootRef = useRef<HTMLDivElement>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        // Only allow pull to refresh if we are at the top of the scroll container.
        // Read scrollTop from the real scrollable ancestor (body is overflow:hidden
        // so window.scrollY is always 0 and cannot be trusted).
        const scrollContainer = findScrollableAncestor(rootRef.current);
        const atTop = scrollContainer !== null
            ? scrollContainer.scrollTop <= 0
            : window.scrollY === 0; // fallback for non-hidden-body layouts
        if (atTop) {
            startY.current = e.touches[0].clientY;
            isDragging.current = true;
        }
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || isRefreshing) return;
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0) {
            // Resistance calculation for professional pull feel
            const offset = Math.min(dy * 0.4, threshold + 20);
            setPullOffset(offset);

            // Prevent scrolling while pulling
            if (dy > 10) {
                if (e.cancelable) e.preventDefault();
            }
        }
    };

    const onTouchEnd = async () => {
        if (pullOffset >= threshold) {
            setIsRefreshing(true);
            setPullOffset(threshold);
            if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]); // Subtle haptic pattern
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullOffset(0);
            }
        } else {
            setPullOffset(0);
        }
        isDragging.current = false;
    };

    const onTouchCancel = () => {
        isDragging.current = false;
        setPullOffset(0);
    };

    return (
        <div
            ref={rootRef}
            className="relative w-full h-full touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
        >
            {/* Pull Indicator */}
            <div
                className="absolute top-0 left-0 w-full flex justify-center items-center overflow-hidden transition-all duration-300"
                style={{ height: `${pullOffset}px`, opacity: pullOffset / threshold }}
            >
                <div className={`p-2 bg-white rounded-full shadow-lg border border-slate-100 ${isRefreshing ? 'animate-spin' : ''}`}>
                    <RefreshCw size={20} className="text-blue-600" />
                </div>
            </div>

            <div
                className="transition-transform duration-300 ease-out"
                style={{ transform: `translateY(${pullOffset}px)` }}
            >
                {children}
            </div>
        </div>
    );
};
