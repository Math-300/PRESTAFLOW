
import React from 'react';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => {
    return (
        <div className={`animate-pulse bg-slate-200 rounded-md ${className}`} />
    );
};

export const TableSkeleton: React.FC = () => {
    return (
        <div className="space-y-4 w-full">
            {/* Toolbar Skeleton */}
            <div className="flex justify-between items-center gap-4">
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-48" />
            </div>

            {/* Table Header Skeleton */}
            <div className="hidden md:grid grid-cols-6 gap-4 p-4 bg-slate-50 border-y border-slate-200">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24 ml-auto" />
                <Skeleton className="h-4 w-24 ml-auto" />
            </div>

            {/* Rows Skeletons */}
            {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col md:grid md:grid-cols-6 gap-4 p-4 border-b border-slate-100">
                    <div className="flex md:hidden justify-between mb-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-5 w-8 hidden md:block" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24 hidden md:block" />
                    <Skeleton className="h-4 w-32 hidden md:block" />
                    <Skeleton className="h-6 w-24 ml-auto" />
                    <Skeleton className="h-8 w-24 ml-auto hidden md:block" />
                </div>
            ))}
        </div>
    );
};

export const CardStatsSkeleton: React.FC = () => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-3 w-16" />
                </div>
            ))}
        </div>
    );
};
