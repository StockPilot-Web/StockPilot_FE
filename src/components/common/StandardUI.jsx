import React from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * Bảng màu chuẩn hệ thống:
 * - blue: thao tác chính / thông tin
 * - green: thành công
 * - amber: cảnh báo
 * - red: lỗi / nguy hiểm
 * - slate: trung tính
 */
const TONE_MAP = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  green: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    iconBg: 'bg-red-100 text-red-600',
  },
  slate: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    iconBg: 'bg-slate-100 text-slate-600',
  },
};

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function KpiCard({ icon: Icon, label, value, sub, tone = 'blue', pulse = false, onClick }) {
  const palette = TONE_MAP[tone] || TONE_MAP.blue;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3.5 shadow-xs transition-all ${
        onClick ? 'hover:border-blue-300 hover:shadow-sm cursor-pointer' : ''
      }`}
    >
      {Icon && (
        <div className={`w-11 h-11 rounded-xl ${palette.iconBg} flex items-center justify-center shrink-0 relative`}>
          <Icon className="w-5 h-5" />
          {pulse && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </Comp>
  );
}

export function StatusBadge({ label, tone = 'slate', icon: Icon, className = '' }) {
  const palette = TONE_MAP[tone] || TONE_MAP.slate;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${palette.bg} ${palette.text} ${palette.border} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{label}</span>
    </span>
  );
}

export function LoadingState({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 py-16 px-4 flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 py-14 px-6 flex flex-col items-center justify-center gap-2.5 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-1">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  message = 'Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại.',
  onRetry,
  retryLabel = 'Thử lại',
}) {
  return (
    <div className="bg-red-50/70 rounded-2xl border border-red-200 py-12 px-6 flex flex-col items-center justify-center gap-2.5 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-1">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-red-900">{title}</h3>
      {message && <p className="text-sm text-red-700 max-w-md">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Bảng dữ liệu chuẩn:
 * - Cuộn ngang trong khung riêng trên màn hình nhỏ (overflow-x-auto)
 * - Tự động căn phải & thêm tabular-nums cho cột numeric (align: 'right')
 */
export function DataTable({ columns, rows, keyField = 'id', empty, loading, error, onRetry }) {
  if (loading && (!rows || rows.length === 0)) {
    return <LoadingState />;
  }
  if (error && (!rows || rows.length === 0)) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (!rows || rows.length === 0) {
    return empty || <EmptyState title="Chưa có dữ liệu" />;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.headerClassName || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={row[keyField] ?? idx} className="hover:bg-slate-50/70 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 ${
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.cellClassName || ''}`}
                  >
                    {col.render ? col.render(row, idx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
