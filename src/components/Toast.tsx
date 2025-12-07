import React, { useEffect } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';

export interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: (id: string) => void;
}

export function Toast({ id, message, type = 'success', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  return (
    <div
      className={`${getBackgroundColor()} border rounded-lg shadow-lg p-4 flex items-center space-x-3 min-w-[300px] max-w-md animate-slide-in-right`}
      role="alert"
    >
      {getIcon()}
      <p className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
