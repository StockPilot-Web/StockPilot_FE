/**
 * Nhận diện thiết bị cho tính năng chặn thiết bị của Admin (backend: utils/device-identity.ts).
 *
 * - Mã thiết bị (X-Device-Id): UUID ngẫu nhiên lưu trong localStorage — chính xác từng trình duyệt,
 *   mất khi người dùng xóa dữ liệu trang.
 * - Vân tay phần cứng (X-Device-Fp): SHA-256 của các đặc điểm phần cứng/trình duyệt (GPU, màn hình,
 *   số nhân CPU, RAM, múi giờ, kết quả vẽ canvas). Vẫn giữ sau khi xóa dữ liệu trang, nhưng máy giống hệt
 *   cấu hình có thể trùng.
 * Trình duyệt không cho web đọc số serial phần cứng thật, nên đây là hai tín hiệu mạnh nhất có được.
 * Không gửi dữ liệu thô nào lên server — chỉ gửi mã băm.
 */
const DEVICE_ID_KEY = 'stockpilot-device-id';

let deviceIdCache = null;
let fingerprintPromise = null;

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceId() {
  if (deviceIdCache) return deviceIdCache;
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored && /^[a-z0-9-]{16,64}$/.test(stored)) {
      deviceIdCache = stored;
      return stored;
    }
    const created = randomId();
    localStorage.setItem(DEVICE_ID_KEY, created);
    deviceIdCache = created;
    return created;
  } catch {
    // localStorage bị chặn (chế độ riêng tư): dùng mã tạm cho phiên này.
    deviceIdCache = deviceIdCache || randomId();
    return deviceIdCache;
  }
}

function canvasSignature() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '16px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 1, 60, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('StockPilot ✓ 0123', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('StockPilot ✓ 0123', 4, 17);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function webglSignature() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}|${renderer}|${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`;
  } catch {
    return '';
  }
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function computeFingerprint() {
  if (!globalThis.crypto?.subtle) return null; // chỉ có trên HTTPS / localhost
  const nav = globalThis.navigator || {};
  const scr = globalThis.screen || {};
  const traits = [
    nav.platform,
    nav.hardwareConcurrency,
    nav.deviceMemory,
    nav.maxTouchPoints,
    (nav.languages || []).join(','),
    scr.width,
    scr.height,
    scr.colorDepth,
    globalThis.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    webglSignature(),
    canvasSignature(),
  ];
  return sha256Hex(traits.map((v) => String(v ?? '')).join('||'));
}

/** Vân tay phần cứng (chuỗi hex 64 ký tự) hoặc null nếu trình duyệt không hỗ trợ. Tính một lần. */
export function getDeviceFingerprint() {
  if (!fingerprintPromise) fingerprintPromise = computeFingerprint().catch(() => null);
  return fingerprintPromise;
}

/** Header gắn vào mọi request API. */
export async function getDeviceHeaders() {
  const headers = { 'X-Device-Id': getDeviceId() };
  const fingerprint = await getDeviceFingerprint();
  if (fingerprint) headers['X-Device-Fp'] = fingerprint;
  return headers;
}
