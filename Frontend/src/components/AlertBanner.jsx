import React from 'react';
import PropTypes from 'prop-types';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
  ServerOff,
  Database,
} from 'lucide-react';

export default function AlertBanner({
  type = 'info', // 'info' | 'warning' | 'error' | 'success' | 'offline'
  title,
  message,
  actionText,
  onAction,
  onClose,
  isRetrying = false,
}) {
  const styles = {
    info: {
      bg: 'bg-blue-50/90 border-blue-200 text-blue-900',
      icon: <Info className="h-5 w-5 text-blue-600 shrink-0" />,
      btn: 'text-blue-700 bg-white border-blue-200 hover:bg-blue-50',
    },
    warning: {
      bg: 'bg-amber-50/90 border-amber-200 text-amber-900',
      icon: <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />,
      btn: 'text-amber-700 bg-white border-amber-200 hover:bg-amber-50',
    },
    error: {
      bg: 'bg-rose-50/90 border-rose-200 text-rose-900',
      icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
      btn: 'text-rose-700 bg-white border-rose-200 hover:bg-rose-50',
    },
    success: {
      bg: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
      btn: 'text-emerald-700 bg-white border-emerald-200 hover:bg-emerald-50',
    },
    offline: {
      bg: 'bg-slate-100/90 border-slate-300 text-slate-800',
      icon: <ServerOff className="h-5 w-5 text-amber-600 shrink-0" />,
      btn: 'text-slate-800 bg-white border-slate-300 hover:bg-slate-50',
    },
  }[type] || styles.info;

  return (
    <div
      role="alert"
      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 shadow-2xs ${styles.bg}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="text-xs sm:text-sm">
          {title && <span className="font-bold mr-1.5">{title}</span>}
          <span className="opacity-90">{message}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={isRetrying}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${styles.btn}`}
          >
            {isRetrying && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {actionText}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

AlertBanner.propTypes = {
  type: PropTypes.oneOf(['info', 'warning', 'error', 'success', 'offline']),
  title: PropTypes.string,
  message: PropTypes.node.isRequired,
  actionText: PropTypes.string,
  onAction: PropTypes.func,
  onClose: PropTypes.func,
  isRetrying: PropTypes.bool,
};
