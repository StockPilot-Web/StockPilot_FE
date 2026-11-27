import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Boxes, FileUp,
  LayoutDashboard, LifeBuoy, Package, Settings, ShieldCheck, ShoppingBag,
  ShoppingCart, Store, Users, X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { normalizeRole } from '../../config/permissions.config';
import { useTranslation } from '../../i18n/useTranslation';

export const ONBOARDING_OPEN_EVENT = 'stockpilot-open-onboarding';
const STORAGE_PREFIX = 'stockpilot-onboarding-v1';

const ROLE_COPY = {
  store_owner: {
    title: 'Chào mừng bạn đến với StockPilot',
    subtitle: 'Đi qua các chức năng chính để bắt đầu quản lý cửa hàng hiệu quả hơn.',
    titleEn: 'Welcome to StockPilot',
    subtitleEn: 'Take a quick tour of the key tools for running your store.',
    steps: [
      ['dashboard', LayoutDashboard, 'Tổng quan', 'Theo dõi nhanh tình hình bán hàng, tồn kho và các việc cần chú ý.', '/dashboard', 'Mở Tổng quan'],
      ['products', Package, 'Sản phẩm', 'Quản lý danh mục, giá bán, giá vốn và thông tin sản phẩm.', '/products', 'Mở Sản phẩm'],
      ['import', FileUp, 'Nhập dữ liệu', 'Nhập sản phẩm hoặc lịch sử bán hàng từ Excel/CSV với bước kiểm tra trước khi ghi dữ liệu.', '/import', 'Mở Nhập dữ liệu'],
      ['pos', ShoppingBag, 'Thanh toán POS', 'Tạo đơn tại quầy, quét mã, chọn phương thức thanh toán và hoàn tất bán hàng.', '/pos', 'Mở POS'],
      ['orders', ShoppingCart, 'Đơn hàng', 'Tra cứu, theo dõi trạng thái và xử lý các đơn đã phát sinh.', '/orders', 'Mở Đơn hàng'],
      ['inventory', Boxes, 'Quản lý kho', 'Theo dõi nhập, xuất, điều chỉnh và lịch sử biến động tồn kho.', '/inventory', 'Mở Quản lý kho'],
      ['decision', AlertTriangle, 'Hỗ trợ quyết định', 'Xem cảnh báo rủi ro, gợi ý giá bán, báo cáo và trợ lý Pilot AI.', '/alerts', 'Mở Cảnh báo rủi ro'],
      ['settings', Settings, 'Cài đặt hệ thống', 'Cấu hình cửa hàng, thanh toán, nhân viên, thông báo và dữ liệu.', '/settings', 'Mở Cài đặt'],
      ['support', LifeBuoy, 'Trợ giúp', 'Khi cần hỗ trợ, tạo phiếu để đội StockPilot tiếp nhận và phản hồi.', '/support', 'Mở Hỗ trợ'],
    ],
  },
  warehouse_staff: {
    title: 'Chào mừng bạn đến với StockPilot',
    subtitle: 'Đây là các màn hình bạn sẽ dùng hằng ngày trong kho và tại quầy POS.',
    titleEn: 'Welcome to StockPilot',
    subtitleEn: 'Here are the screens you will use every day in the warehouse and POS.',
    steps: [
      ['dashboard', LayoutDashboard, 'Tổng quan', 'Xem nhanh các chỉ số và việc cần chú ý được cửa hàng giao.', '/dashboard', 'Mở Tổng quan'],
      ['pos', ShoppingBag, 'Thanh toán POS', 'Tạo đơn, quét mã sản phẩm và xác nhận thanh toán cho khách.', '/pos', 'Mở POS'],
      ['inventory', Boxes, 'Quản lý kho', 'Kiểm tra tồn và theo dõi các biến động kho được phân quyền.', '/inventory', 'Mở Quản lý kho'],
      ['products', Package, 'Sản phẩm', 'Tra cứu thông tin sản phẩm và tồn kho; một số trường nhạy cảm sẽ bị giới hạn.', '/products', 'Mở Sản phẩm'],
      ['orders', ShoppingCart, 'Đơn hàng và cảnh báo', 'Theo dõi đơn hàng, cảnh báo tồn và liên hệ hỗ trợ khi có vấn đề.', '/orders', 'Mở Đơn hàng'],
      ['support', LifeBuoy, 'Trợ giúp', 'Gửi phiếu hỗ trợ để đội StockPilot hoặc chủ cửa hàng xử lý.', '/support', 'Mở Hỗ trợ'],
    ],
  },
  admin: {
    title: 'Chào mừng đến khu quản trị StockPilot',
    subtitle: 'Nắm nhanh các khu vực vận hành nền tảng và hỗ trợ cửa hàng.',
    titleEn: 'Welcome to StockPilot Administration',
    subtitleEn: 'Get familiar with platform operations and store support areas.',
    steps: [
      ['dashboard', LayoutDashboard, 'Tổng quan', 'Theo dõi bức tranh tổng thể của nền tảng.', '/dashboard', 'Mở Tổng quan'],
      ['users', Users, 'Người dùng & Quyền', 'Quản lý tài khoản, vai trò và trạng thái truy cập.', '/admin/users', 'Mở Người dùng'],
      ['stores', Store, 'Cửa hàng', 'Theo dõi cửa hàng và trạng thái hoạt động ở cấp nền tảng.', '/admin/stores', 'Mở Cửa hàng'],
      ['support', LifeBuoy, 'Hỗ trợ khách hàng', 'Tiếp nhận và xử lý các yêu cầu hỗ trợ từ cửa hàng.', '/admin/support', 'Mở Hỗ trợ'],
      ['leads', Users, 'Khách hàng tiềm năng', 'Theo dõi lead và lịch sử chăm sóc khách hàng.', '/admin/leads', 'Mở Khách hàng tiềm năng'],
      ['system', ShieldCheck, 'Hệ thống & AI', 'Kiểm tra cấu hình và trạng thái các dịch vụ nền tảng.', '/admin/system', 'Mở Hệ thống'],
      ['ops', BarChart3, 'Vận hành nền tảng', 'Theo dõi các tác vụ và tình trạng vận hành.', '/admin/ops', 'Mở Vận hành'],
      ['security', ShieldCheck, 'Bảo mật & Kiểm soát', 'Rà soát đăng nhập bất thường và nhật ký kiểm soát.', '/admin/security', 'Mở Bảo mật'],
    ],
  },
};

function getStorageKey(user, role) {
  const userId = user?.id || user?.email || 'unknown-user';
  const storeId = user?.storeId || 'platform';
  return `${STORAGE_PREFIX}:${role}:${storeId}:${userId}`;
}

function readCompleted(key) {
  try {
    return window.localStorage.getItem(key) === 'completed';
  } catch {
    return false;
  }
}

function writeCompleted(key) {
  try {
    window.localStorage.setItem(key, 'completed');
  } catch {
    // Onboarding vẫn phải dùng được ở chế độ riêng tư; chỉ mất trạng thái lưu lại.
  }
}

function getTargetSelector(key) {
  const paths = {
    dashboard: '/dashboard', products: '/products', import: '/import', pos: '/pos', orders: '/orders',
    inventory: '/inventory', decision: '/alerts', settings: '/settings', support: '/support',
    users: '/admin/users', stores: '/admin/stores', leads: '/admin/leads', system: '/admin/system',
    ops: '/admin/ops', security: '/admin/security',
  };
  const path = paths[key];
  return path ? `a[href="${path}"]` : null;
}

export function OnboardingGuide() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { language } = useTranslation();
  const isEn = language === 'en';
  const role = normalizeRole(user?.role);
  const content = ROLE_COPY[role] || ROLE_COPY.warehouse_staff;
  const steps = useMemo(() => content.steps, [content]);
  const storageKey = user ? getStorageKey(user, role) : '';
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const closeRef = useRef(null);
  const current = steps[stepIndex];
  const targetSelector = getTargetSelector(current?.[0]);

  useEffect(() => {
    if (!user || !storageKey) return;
    setStepIndex(0);
    setOpen(!readCompleted(storageKey));
  }, [storageKey, user]);

  useEffect(() => {
    const reopen = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_OPEN_EVENT, reopen);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        writeCompleted(storageKey);
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, storageKey]);

  useLayoutEffect(() => {
    if (!open || !targetSelector) {
      setTargetRect(null);
      return undefined;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      setTargetRect(null);
      return undefined;
    }

    target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    let frame = window.requestAnimationFrame(() => {});
    const measure = () => {
      const rect = target.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [open, targetSelector]);

  if (!open || !user || steps.length === 0) return null;

  const [stepKey, Icon, title, description, path, actionLabel] = current;
  const finish = () => {
    writeCompleted(storageKey);
    setOpen(false);
  };
  const next = () => {
    if (stepIndex === steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((value) => value + 1);
  };
  const openCurrentPage = () => {
    navigate(path);
    next();
  };

  const isSmallScreen = window.innerWidth < 768;
  const popoverWidth = 360;
  const popoverStyle = isSmallScreen
    ? { left: 16, right: 16, bottom: 16 }
    : {
        width: popoverWidth,
        top: targetRect ? Math.min(Math.max(16, targetRect.top - 10), window.innerHeight - 400) : '50%',
        left: targetRect && targetRect.right + 20 + popoverWidth <= window.innerWidth - 16
          ? targetRect.right + 20
          : targetRect
          ? Math.max(16, targetRect.left - popoverWidth - 20)
          : '50%',
        transform: targetRect ? undefined : 'translate(-50%, -50%)',
      };

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="presentation">
      {!targetRect && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />}
      {targetRect && (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-blue-500 ring-4 ring-blue-400/30 transition-all duration-200"
          style={{
            top: Math.max(4, targetRect.top - 8),
            left: Math.max(4, targetRect.left - 8),
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
          }}
          aria-hidden="true"
        />
      )}
      <div
        className="fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
                {isEn ? `Step ${stepIndex + 1} of ${steps.length}` : `Bước ${stepIndex + 1}/${steps.length}`}
              </p>
              <h2 id="onboarding-title" className="text-base font-bold text-slate-900">
                {isEn ? getEnglishTitle(stepKey, title) : title}
              </h2>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={finish} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={isEn ? 'Close onboarding' : 'Đóng hướng dẫn'} title={isEn ? 'Close onboarding' : 'Đóng hướng dẫn'}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex items-center gap-1" aria-label={isEn ? 'Onboarding progress' : 'Tiến độ hướng dẫn'}>
            {steps.map((item, index) => (
              <button key={item[0]} type="button" onClick={() => setStepIndex(index)} className={`h-1.5 flex-1 rounded-full transition ${index <= stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`} aria-label={isEn ? `Go to step ${index + 1}` : `Đến bước ${index + 1}`} />
            ))}
          </div>
          <p id="onboarding-description" className="text-sm leading-6 text-slate-600">
            {isEn ? getEnglishDescription(stepKey, description) : description}
          </p>
          <button type="button" onClick={openCurrentPage} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {isEn ? getEnglishAction(stepKey, actionLabel) : actionLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={finish} className="text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500">
            {isEn ? 'Skip for now' : 'Bỏ qua, xem sau'}
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <ArrowLeft className="h-4 w-4" />
              {isEn ? 'Back' : 'Quay lại'}
            </button>
            <button type="button" onClick={next} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {stepIndex === steps.length - 1 ? (isEn ? 'Finish' : 'Hoàn tất') : (isEn ? 'Next' : 'Tiếp theo')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function getEnglishDescription(key, fallback) {
  const descriptions = {
    dashboard: 'See a quick summary of sales, inventory and items that need attention.',
    products: 'Manage product information, categories, selling prices and stock details.',
    import: 'Import products or sales history from Excel/CSV with validation before saving.',
    pos: 'Create counter orders, scan products, choose payment and complete sales.',
    orders: 'Search orders, follow their status and handle order operations.',
    inventory: 'Track stock receipts, issues, adjustments and inventory movements.',
    decision: 'Review risk alerts, price suggestions, reports and the Pilot AI assistant.',
    settings: 'Configure your store, payments, staff, notifications and data.',
    support: 'Create a ticket when you need the StockPilot team to help.',
    users: 'Manage accounts, roles and access status.',
    stores: 'Monitor stores and their platform-level activity status.',
    leads: 'Track leads and customer care history.',
    system: 'Check platform configuration and service status.',
    ops: 'Monitor platform operations and background tasks.',
    security: 'Review unusual logins and control/audit information.',
  };
  return descriptions[key] || fallback;
}

function getEnglishTitle(key, fallback) {
  const titles = {
    dashboard: 'Dashboard', products: 'Products', import: 'Data Import', pos: 'POS checkout', orders: 'Orders',
    inventory: 'Inventory', decision: 'Decision support', settings: 'System settings', support: 'Support',
    users: 'Users & permissions', stores: 'Stores', leads: 'Leads', system: 'System & AI', ops: 'Platform operations',
    security: 'Security & controls',
  };
  return titles[key] || fallback;
}

function getEnglishAction(key, fallback) {
  const actions = {
    dashboard: 'Open Dashboard', products: 'Open Products', import: 'Open Data Import', pos: 'Open POS',
    orders: 'Open Orders', inventory: 'Open Inventory', decision: 'Open Risk Alerts', settings: 'Open Settings',
    support: 'Open Support', users: 'Open Users', stores: 'Open Stores', leads: 'Open Leads', system: 'Open System',
    ops: 'Open Operations', security: 'Open Security',
  };
  return actions[key] || fallback;
}

export default OnboardingGuide;
