import React, { useState, useRef, useCallback } from 'react';

interface GestureConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onPullDown?: (offset: number) => void;
    onPullEnd?: () => void;
    threshold?: number;
}

export const useGestures = (config: GestureConfig) => {
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const startPos = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const startTime = useRef(0);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startTime.current = Date.now();
        isDragging.current = true;
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging.current) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dx = currentX - startPos.current.x;
        const dy = currentY - startPos.current.y;

        // Horizonal focus if dx is dominant
        if (Math.abs(dx) > Math.abs(dy)) {
            setOffsetX(dx);
        } else if (dy > 0 && config.onPullDown) {
            // Vertical focus for pull-to-refresh
            setOffsetY(dy);
            config.onPullDown(dy);
        }
    }, [config]);

    const onTouchEnd = useCallback(() => {
        isDragging.current = false;
        const duration = Date.now() - startTime.current;
        const threshold = config.threshold || 100;

        // Swipe Logic
        if (Math.abs(offsetX) > threshold) {
            if (offsetX < 0 && config.onSwipeLeft) config.onSwipeLeft();
            if (offsetX > 0 && config.onSwipeRight) config.onSwipeRight();
        }

        // Reset offsets
        setOffsetX(0);
        setOffsetY(0);
        if (config.onPullEnd) config.onPullEnd();
    }, [offsetX, offsetY, config]);

    return { onTouchStart, onTouchMove, onTouchEnd, offsetX, offsetY };
};
