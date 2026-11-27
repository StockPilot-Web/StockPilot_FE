const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Format số tiền VND chuẩn (tabular-nums friendly).
 */
export function formatVND(value, fallback = '0 đ') {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return `${Math.round(num).toLocaleString('vi-VN')} đ`;
}

/**
 * Format số lượng / số nguyên hoặc thập phân gọn.
 */
export function formatNumber(value, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num.toLocaleString('vi-VN');
}

/**
 * Format phần trăm thống nhất.
 */
export function formatPercent(value, { decimals = 1, signed = false, fallback = '0%' } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const fixed = Number.isInteger(num) ? String(num) : num.toFixed(decimals);
  const prefix = signed && num > 0 ? '+' : '';
  return `${prefix}${fixed}%`;
}

/**
 * Format ngày giờ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
export function formatDateTimeVN(iso, { isEn = false, includeTime = true, fallback = '—' } = {}) {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;

  const datePart = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  if (!includeTime) return datePart;

  const timePart = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'vi-VN', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${timePart} ${datePart}`;
}

export function formatDateVN(iso, fallback = '—') {
  return formatDateTimeVN(iso, { includeTime: false, fallback });
}
