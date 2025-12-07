import React from 'react';
import { Bell, AlertTriangle } from 'lucide-react';

interface AlertBadgeProps {
  count: number;
  hasHighPriority?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AlertBadge({ count, hasHighPriority = false, onClick, className = '' }: AlertBadgeProps) {
  if (count === 0) {
    return (
      <button
        onClick={onClick}
        className={`
          relative p-2 text-gray-400 dark:text-gray-500 
          hover:text-gray-600 dark:hover:text-gray-300 
          transition-colors ${className}
        `}
      >
        <Bell className="w-6 h-6" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        relative p-2 transition-colors ${
          hasHighPriority 
            ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300' 
            : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
        } ${className}
      `}
    >
      {hasHighPriority ? (
        <AlertTriangle className="w-6 h-6 animate-pulse" />
      ) : (
        <Bell className="w-6 h-6" />
      )}
      
      {/* Badge */}
      <span className={`
        absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white 
        transform translate-x-1/2 -translate-y-1/2 rounded-full min-w-[20px] h-5 ${
          hasHighPriority 
            ? 'bg-red-600 dark:bg-red-500 animate-pulse' 
            : count > 9 
              ? 'bg-blue-600 dark:bg-blue-500' 
              : 'bg-blue-600 dark:bg-blue-500'
        }
      `}>
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}