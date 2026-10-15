import React from 'react';
import PropTypes from 'prop-types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

/**
 * Reusable StatCard / KPI Card component for enterprise metric displays.
 * Supports loading/empty states cleanly without displaying fabricated data.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'neutral',
  subtitle,
  badge,
  empty = false,
  emptyText = 'Data awaiting sync',
  actionText,
  onAction,
}) {
  const getChangeBadge = () => {
    if (!change) return null;

    if (changeType === 'positive') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          <ArrowUpRight className="w-3 h-3" />
          {change}
        </span>
      );
    }
    if (changeType === 'negative') {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
          <ArrowDownRight className="w-3 h-3" />
          {change}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        <Minus className="w-3 h-3" />
        {change}
      </span>
    );
  };

  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {badge}
            </span>
          )}
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-600/10 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        {empty ? (
          <div className="flex items-center gap-2 py-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-400 italic">
              {emptyText}
            </span>
          </div>
        ) : (
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {value ?? '--'}
          </p>
        )}

        {!empty && getChangeBadge()}
      </div>

      {(subtitle || actionText) && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          {subtitle && <span>{subtitle}</span>}
          {actionText && (
            <button
              type="button"
              onClick={onAction}
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              {actionText} &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.elementType,
  change: PropTypes.string,
  changeType: PropTypes.oneOf(['positive', 'negative', 'neutral']),
  subtitle: PropTypes.string,
  badge: PropTypes.string,
  empty: PropTypes.bool,
  emptyText: PropTypes.string,
  actionText: PropTypes.string,
  onAction: PropTypes.func,
};
