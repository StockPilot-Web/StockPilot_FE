import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Search, Bell, Sun, Moon, Globe, Check, CheckCheck,
  Store, Warehouse, ShieldCheck, AlertTriangle, Tag, Info, ChevronDown,
  User, Boxes, LogOut, Settings, UserPlus, HelpCircle, X, Lock, Mail, Building2, ShoppingBag, Users, Package, LifeBuoy, ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { apiUpdateMe } from '../../services/authService';
import { useUIStore } from '../store/uiStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useToast } from '../common/Toast';
import { Breadcrumbs } from './Breadcrumbs';
import { ONBOARDING_OPEN_EVENT } from '../common/OnboardingGuide';
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../../services/analyticsService';
import { normalizeRole } from '../../config/permissions.config';

function formatRelativeTime(dateStr, isEn) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) return isEn ? 'Just now' : 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return isEn ? `${diffHour}h ago` : `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return isEn ? `${diffDay}d ago` : `${diffDay} ngày trước`;
}

function formatNotificationText(title, desc, isEn) {
  if (!isEn) return { title: title || '', desc: desc || '' };
  let t = title || '';
  let d = desc || '';

  // Title translation
  if (t.includes('Hết hàng:')) {
    t = t.replace('Hết hàng:', 'Out of Stock:');
  } else if (t.includes('Cảnh báo tồn kho thấp')) {
    t = t.replace('Cảnh báo tồn kho thấp:', 'Low Stock Alert:');
  } else if (t.includes('Cảnh báo thừa hàng')) {
    t = t.replace('Cảnh báo thừa hàng:', 'Overstock Alert:');
  } else if (t.includes('Đề xuất tăng giá') || t.includes('Gợi ý tăng giá')) {
    t = t.replace(/(Đề xuất|Gợi ý) tăng giá:/, 'Price Increase:');
  } else if (t.includes('Đề xuất giảm giá') || t.includes('Gợi ý giảm giá')) {
    t = t.replace(/(Đề xuất|Gợi ý) giảm giá:/, 'Price Markdown:');
  } else if (t.includes('Gợi ý giá mới')) {
    t = t.replace('Gợi ý giá mới:', 'New Price Suggestion:');
  } else if (t.includes('Đơn hàng mới')) {
    t = t.replace('Đơn hàng mới:', 'New Order:');
  } else if (t.includes('Hệ thống đồng bộ thành công') || t.includes('Đồng bộ dữ liệu')) {
    t = 'System Synchronized Successfully';
  }

  // Description translation
  if (d.includes('chỉ còn') && d.includes('khả dụng')) {
    d = d.replace(/Sản phẩm (\w+) chỉ còn (\d+) đơn vị khả dụng, dưới điểm đặt hàng (\d+)\./, 'Product $1 has only $2 units left, below reorder point of $3.');
  } else if (d.includes('hiện có sẵn 0 sản phẩm')) {
    d = d.replace(/Sản phẩm (\w+) hiện có sẵn 0 sản phẩm trong kho\. Cần nhập hàng khẩn cấp\./, 'Product $1 has 0 units in stock. Urgent restock required.');
  } else if (d.includes('vượt ngưỡng an toàn')) {
    d = d.replace(/Sản phẩm (\w+) có mức tồn kho vượt ngưỡng an toàn so với tốc độ tiêu thụ hiện tại\./, 'Product $1 stock exceeds safe threshold relative to sales velocity.');
  } else if (d.includes('AI đề xuất điều chỉnh giá từ') || d.includes('AI đề xuất điều chỉnh')) {
    d = d.replace(/AI đề xuất điều chỉnh (giá )?từ ([\d\.]+) đ lên ([\d\.]+) đ.*/, 'AI recommends adjusting price from $2 đ to $3 đ to achieve target margin.');
  } else if (d.includes('Hóa đơn bán lẻ trị giá')) {
    d = d.replace(/Hóa đơn bán lẻ trị giá ([\d\.]+) đ đã được (thanh toán thành công|lập thành công).*/, 'Retail order of $1 đ was successfully created.');
  } else if (d.includes('Dữ liệu tồn kho và số liệu')) {
    d = 'Inventory stock and business analytics synchronized with live database.';
  }

  return { title: t, desc: d };
}

export function Topbar() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuthStore();
  const { theme, setTheme, setSidebarMobileOpen, openCommandPalette } = useUIStore();
  const { t, language, toggleLanguage } = useTranslation();
  const { toast } = useToast();
  const isEn = language === 'en';

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Modals triggered from User Menu
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const openAccountModal = () => {
    setProfileName(user?.name || user?.fullName || '');
    setAccountModalOpen(true);
  };

  const saveProfile = async () => {
    const fullName = profileName.trim();
    if (fullName.length < 2) {
      toast({ type: 'warning', title: isEn ? 'Name is too short' : 'Họ tên quá ngắn', message: isEn ? 'Enter at least 2 characters.' : 'Nhập ít nhất 2 ký tự.' });
      return;
    }
    if (fullName === (user?.name || user?.fullName || '')) {
      setAccountModalOpen(false);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await apiUpdateMe({ fullName });
      useAuthStore.setState((state) => ({ user: { ...state.user, fullName: updated.fullName, name: updated.fullName } }));
      setAccountModalOpen(false);
      toast({ type: 'success', title: isEn ? 'Profile updated' : 'Đã cập nhật hồ sơ', message: isEn ? 'Your name has been saved.' : 'Đã lưu họ tên mới.' });
    } catch (err) {
      toast({ type: 'error', title: isEn ? 'Could not save' : 'Không lưu được', message: err?.response?.data?.error?.message || (isEn ? 'Could not reach the server.' : 'Không kết nối được máy chủ.') });
    } finally {
      setSavingProfile(false);
    }
  };
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const notificationRequestRef = useRef(false);

  const currentRole = normalizeRole(user?.role);

  const helpTopics = currentRole === 'admin'
    ? [
        { icon: Users, title: isEn ? 'Manage users and permissions' : 'Quản lý người dùng và quyền', desc: isEn ? 'Create accounts, assign roles and control access.' : 'Tạo tài khoản, phân vai trò và kiểm soát quyền truy cập.', path: '/admin/users', action: isEn ? 'Open Users' : 'Mở Người dùng' },
        { icon: Store, title: isEn ? 'Monitor stores' : 'Theo dõi cửa hàng', desc: isEn ? 'Review store status and operational information.' : 'Kiểm tra trạng thái và thông tin vận hành của cửa hàng.', path: '/admin/stores', action: isEn ? 'Open Stores' : 'Mở Cửa hàng' },
        { icon: LifeBuoy, title: isEn ? 'Handle support requests' : 'Xử lý yêu cầu hỗ trợ', desc: isEn ? 'Receive, assign and respond to requests from stores.' : 'Tiếp nhận, phân công và phản hồi yêu cầu từ cửa hàng.', path: '/admin/support', action: isEn ? 'Open Support' : 'Mở Hỗ trợ' },
        { icon: ShieldCheck, title: isEn ? 'Review security' : 'Kiểm tra bảo mật', desc: isEn ? 'Review unusual login activity and control records.' : 'Rà soát đăng nhập bất thường và nhật ký kiểm soát.', path: '/admin/security', action: isEn ? 'Open Security' : 'Mở Bảo mật' },
      ]
    : currentRole === 'warehouse_staff'
    ? [
        { icon: ShoppingBag, title: isEn ? 'Sell at the counter' : 'Bán hàng tại quầy', desc: isEn ? 'Create orders, scan products and confirm payments.' : 'Tạo đơn, quét sản phẩm và xác nhận thanh toán.', path: '/pos', action: isEn ? 'Open POS' : 'Mở POS' },
        { icon: Boxes, title: isEn ? 'Process inventory' : 'Xử lý tồn kho', desc: isEn ? 'Check stock and follow inventory movements assigned to you.' : 'Kiểm tra tồn và theo dõi biến động kho được phân quyền.', path: '/inventory', action: isEn ? 'Open Inventory' : 'Mở Quản lý kho' },
        { icon: Package, title: isEn ? 'Find products' : 'Tra cứu sản phẩm', desc: isEn ? 'Search product information and available stock.' : 'Tìm thông tin sản phẩm và số lượng tồn khả dụng.', path: '/products', action: isEn ? 'Open Products' : 'Mở Sản phẩm' },
        { icon: LifeBuoy, title: isEn ? 'Request support' : 'Gửi yêu cầu hỗ trợ', desc: isEn ? 'Create a ticket when an operational issue needs help.' : 'Tạo phiếu khi có vấn đề vận hành cần được hỗ trợ.', path: '/support', action: isEn ? 'Open Support' : 'Mở Hỗ trợ' },
      ]
    : [
        { icon: Settings, title: isEn ? 'Set up your store' : 'Thiết lập cửa hàng', desc: isEn ? 'Update store information, payments and notifications.' : 'Cập nhật thông tin cửa hàng, thanh toán và thông báo.', path: '/settings', action: isEn ? 'Open Settings' : 'Mở Cài đặt' },
        { icon: Package, title: isEn ? 'Manage products and data' : 'Quản lý sản phẩm và dữ liệu', desc: isEn ? 'Add products or import products and sales history from Excel/CSV.' : 'Thêm sản phẩm hoặc nhập sản phẩm, lịch sử bán hàng từ Excel/CSV.', path: '/products', action: isEn ? 'Open Products' : 'Mở Sản phẩm' },
        { icon: ShoppingBag, title: isEn ? 'Run daily sales' : 'Vận hành bán hàng hằng ngày', desc: isEn ? 'Create POS orders and follow order status.' : 'Tạo đơn POS và theo dõi trạng thái đơn hàng.', path: '/pos', action: isEn ? 'Open POS' : 'Mở POS' },
        { icon: Boxes, title: isEn ? 'Control inventory' : 'Kiểm soát tồn kho', desc: isEn ? 'Review stock, movements and low-stock warnings.' : 'Theo dõi tồn, biến động kho và cảnh báo sắp hết hàng.', path: '/inventory', action: isEn ? 'Open Inventory' : 'Mở Quản lý kho' },
      ];

  // Fetch notifications từ API thật (bảng notifications trong MySQL) - Chỉ áp dụng cho người dùng thuộc Store
  const fetchRealNotifications = async () => {
    if (!user || currentRole === 'admin' || document.visibilityState !== 'visible' || notificationRequestRef.current) return;
    notificationRequestRef.current = true;
    try {
      const data = await apiGetNotifications({ page: 1, limit: 30 });
      const items = Array.isArray(data) ? data : (data.items || data.data || []);
      const mapped = items.map((n) => ({
        id: n.id,
        title: n.title || n.type || 'Thông báo',
        desc: n.message || n.body || '',
        rawTime: n.createdAt,
        type: n.type || 'system',
        entityType: n.entityType,
        entityId: n.entityId,
        isRead: Boolean(n.isRead),
      }));
      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      notificationRequestRef.current = false;
    }
  };

  useEffect(() => {
    if (currentRole === 'admin') return;
    fetchRealNotifications();
    // Chỉ polling khi tab đang hiển thị; không chồng request nếu API phản hồi chậm.
    const interval = setInterval(fetchRealNotifications, 12000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchRealNotifications();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, currentRole]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotificationsOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast({ type: 'info', title: isEn ? 'Signed out' : 'Đã đăng xuất', message: isEn ? 'See you again!' : 'Hẹn gặp lại!' });
    navigate('/login');
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiMarkAllNotificationsRead();
    } catch (_) {}
    toast({
      type: 'success',
      title: isEn ? 'All caught up' : 'Đã đọc tất cả',
      message: isEn ? 'All notifications marked as read.' : 'Đã đánh dấu đã đọc tất cả thông báo.'
    });
  };

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, isRead: true } : item));
      try {
        await apiMarkNotificationRead(n.id);
      } catch (_) {}
    }
    setNotificationsOpen(false);

    if (n.type === 'alert' || n.entityType === 'ALERT') {
      navigate('/alerts');
    } else if (n.type === 'pricing' || n.entityType === 'PRICING') {
      navigate('/pricing');
    } else if (n.type === 'order' || n.entityType === 'ORDER') {
      navigate('/orders');
    } else if (n.entityType === 'SUPPORT_TICKET') {
      navigate(`/support?ticket=${n.entityId}`);
    } else {
      navigate('/settings');
    }
  };

  const isAdmin = currentRole === 'admin';

  return (
    <header
      className={cn(
        'h-16 sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6 transition-colors',
        isAdmin
          ? 'bg-white border-b border-[#E5E7EB] text-[#475569]'
          : 'bg-white/95 backdrop-blur-md border-b border-blue-100/70 text-slate-900'
      )}
    >
      {/* Left: Mobile toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className={cn(
            'p-2 -ml-2 rounded-lg lg:hidden transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          aria-label="Mở thanh điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Breadcrumbs />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Badge (Phân định màu sắc chuẩn yêu cầu RBAC) */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border select-none transition-colors',
            currentRole === 'store_owner' && 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold',
            currentRole === 'warehouse_staff' && 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
            currentRole === 'admin' && 'bg-slate-700 text-white border-slate-700 font-medium'
          )}
        >
          {currentRole === 'store_owner' && <Store className="w-3.5 h-3.5" />}
          {currentRole === 'warehouse_staff' && <Warehouse className="w-3.5 h-3.5 text-emerald-600" />}
          {currentRole === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}
          <span>
            {currentRole === 'store_owner'
              ? isEn
                ? 'Store Owner'
                : 'Chủ shop'
              : currentRole === 'warehouse_staff'
              ? isEn
                ? 'Staff'
                : 'Nhân viên'
              : isEn
              ? 'Admin'
              : 'Quản trị viên'}
          </span>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer',
            language === 'en'
              ? 'border-blue-500 bg-blue-50/70 text-blue-700 shadow-xs ring-1 ring-blue-400/30'
              : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
          )}
          title={language === 'vi' ? 'Switch to English (EN)' : 'Chuyển sang Tiếng Việt (VI)'}
        >
          <Globe
            className={cn(
              'w-3.5 h-3.5',
              language === 'en'
                ? 'text-blue-600'
                : 'text-slate-600'
            )}
          />
          <span className="uppercase font-extrabold">{language}</span>
        </button>

        {/* Notification Bell (store users only) */}
        {!isAdmin && (
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-card" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{t('notifications', 'Thông báo')}</span>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} {t('new', 'mới')}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t('markAllRead', 'Đã đọc')}
                  </button>
                )}
              </div>

              <div className="max-h-84 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold">{isEn ? 'No notifications yet' : 'Chưa có thông báo nào'}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{isEn ? 'New alerts and order events will appear here' : 'Cảnh báo kho và đơn hàng mới sẽ xuất hiện tại đây'}</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const formatted = formatNotificationText(n.title, n.desc, isEn);
                    const timeAgo = formatRelativeTime(n.rawTime, isEn);
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          'p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3',
                          !n.isRead && 'bg-blue-50/60 hover:bg-blue-50/90'
                        )}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="mt-0.5 shrink-0">
                          {n.type === 'alert' && (
                            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {n.type === 'pricing' && (
                            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                              <Tag className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {n.type === 'order' && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {n.type === 'system' && (
                            <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={cn('text-xs truncate', !n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-600')}>
                              {formatted.title}
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">{timeAgo}</span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{formatted.desc}</p>
                        </div>
                        {!n.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 bg-muted/30 border-t border-border text-center">
                <button onClick={() => { navigate('/alerts'); setNotificationsOpen(false); }} className="text-xs font-medium text-blue-600 hover:underline">
                  {isEn ? 'View all alerts center →' : 'Xem toàn bộ trung tâm cảnh báo →'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex items-center gap-2 p-1 rounded-lg transition-colors cursor-pointer',
              'hover:bg-muted'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs',
                'bg-blue-600'
              )}
            >
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.name ? user.name.charAt(0) : 'A'}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold truncate max-w-28 text-foreground">
                {user?.fullName || user?.name || (isEn ? 'User' : 'Người dùng')}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {currentRole === 'store_owner'
                  ? isEn
                    ? 'Store Owner'
                    : 'Chủ cửa hàng'
                  : currentRole === 'warehouse_staff'
                  ? isEn
                    ? 'Warehouse Staff'
                    : 'Nhân viên kho'
                  : isEn
                  ? 'Admin'
                  : 'Quản trị viên'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div
              className={cn(
                'absolute right-0 mt-2 w-72 rounded-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 border shadow-2xl',
                'bg-white border-slate-200 text-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]'
              )}
            >
              {/* User Profile Header */}
              <div
                className={cn(
                  'p-3 rounded-xl border mb-2',
                  'bg-linear-to-r from-blue-50 to-indigo-50/60 border-blue-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full text-white font-extrabold text-sm flex items-center justify-center shadow-md shrink-0',
                      'bg-blue-600'
                    )}
                  >
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.name ? user.name.charAt(0) : 'A'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-slate-900">
                      {user?.fullName || user?.name || 'Administrator'}
                    </p>
                    <p className="text-xs truncate text-slate-500">
                      {user?.email || ''}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs',
                          'bg-blue-600 text-white'
                        )}
                      >
                        {currentRole === 'store_owner'
                          ? isEn
                            ? 'Store Owner (Full Access)'
                            : 'Chủ shop (Toàn quyền)'
                          : currentRole === 'warehouse_staff'
                          ? isEn
                            ? 'Warehouse Staff'
                            : 'NV Kho (Nhập/xuất)'
                          : isEn
                          ? 'Platform admin'
                          : 'Quản trị viên nền tảng'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Functional Menu Items */}
              <div className="space-y-1 py-1">
                {/* THÔNG TIN TÀI KHOẢN */}
                <button
                  onClick={() => {
                    openAccountModal();
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center gap-2.5 font-medium cursor-pointer',
                    'text-slate-700 hover:text-blue-700 hover:bg-blue-50/80'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      'bg-blue-100 text-blue-600'
                    )}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold text-slate-800">
                      {isEn ? 'Account Information' : 'Thông tin tài khoản'}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {isEn ? 'Personal profile, email & security' : 'Hồ sơ cá nhân, email & bảo mật'}
                    </span>
                  </div>
                </button>

                {!isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/staff');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/80 rounded-xl transition-colors flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block font-bold text-slate-800">{isEn ? 'Staff' : 'Nhân viên'}</span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {isEn ? 'Staff list, add, edit & permissions' : 'Danh sách, thêm mới, sửa đổi & phân quyền'}
                      </span>
                    </div>
                  </button>
                )}

                {/* TRỢ GIÚP & HƯỚNG DẪN */}
                <button
                  onClick={() => {
                    setHelpModalOpen(true);
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center gap-2.5 font-medium cursor-pointer',
                    'text-slate-700 hover:text-blue-700 hover:bg-blue-50/80'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      'bg-cyan-100 text-cyan-600'
                    )}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold text-slate-800">
                      {isEn ? 'Help & Documentation' : 'Trợ giúp & Hướng dẫn'}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {isEn ? 'User guides & Pilot AI assistant' : 'Tài liệu HDSD & trợ lý Pilot AI'}
                    </span>
                  </div>
                </button>
              </div>

              {/* ĐĂNG XUẤT KHỎI HỆ THỐNG */}
              <div className="pt-1 mt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-bold flex items-center gap-2.5 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>{isEn ? 'Sign Out' : 'Đăng xuất khỏi hệ thống'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: THÔNG TIN TÀI KHOẢN (Xếp thứ 1)                       */}
      {/* ============================================================== */}
      {accountModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{isEn ? 'Account Information' : 'Thông tin tài khoản'}</h3>
                  <p className="text-xs text-slate-400">{isEn ? 'Manage personal profile & security' : 'Quản lý hồ sơ cá nhân & bảo mật'}</p>
                </div>
              </div>
              <button onClick={() => setAccountModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 my-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{isEn ? 'Full name' : 'Họ và tên'}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={255} className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{isEn ? 'Login email' : 'Email đăng nhập'}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input type="email" value={user?.email || ''} readOnly className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-500 cursor-not-allowed focus:outline-none" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{isEn ? 'The login email cannot be changed here.' : 'Email đăng nhập không đổi được tại đây.'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{isEn ? 'Current role' : 'Vai trò hiện tại'}</label>
                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-bold text-blue-700">
                    {currentRole === 'store_owner'
                      ? (isEn ? 'Store Owner (Full Administrative Access)' : 'Chủ cửa hàng (Toàn quyền quản trị)')
                      : currentRole === 'warehouse_staff'
                      ? (isEn ? 'Warehouse Staff & POS' : 'Nhân viên kho & POS')
                      : (isEn ? 'System Administrator' : 'Quản trị viên hệ thống')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setAccountModalOpen(false)} className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
                {isEn ? 'Close' : 'Đóng'}
              </button>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl shadow-sm"
              >
                {savingProfile ? (isEn ? 'Saving...' : 'Đang lưu...') : (isEn ? 'Save changes' : 'Lưu thay đổi')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}




      {/* ============================================================== */}
      {/* MODAL 6: TRỢ GIÚP & HƯỚNG DẪN                                  */}
      {/* ============================================================== */}
      {helpModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{isEn ? 'Help center' : 'Trung tâm trợ giúp'}</h3>
                  <p className="text-xs text-slate-500">{isEn ? 'Operational guidance for your role' : 'Hướng dẫn nghiệp vụ theo vai trò của bạn'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setHelpModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={isEn ? 'Close help center' : 'Đóng trung tâm trợ giúp'}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 px-5 py-4" role="list" aria-label={isEn ? 'Operational help topics' : 'Nhóm hướng dẫn nghiệp vụ'}>
              {helpTopics.map(({ icon: TopicIcon, title, desc, path, action }) => (
                <div key={path} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40" role="listitem">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <TopicIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{desc}</p>
                  </div>
                  <button type="button" onClick={() => { setHelpModalOpen(false); navigate(path); }} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {action}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => { setHelpModalOpen(false); window.dispatchEvent(new CustomEvent(ONBOARDING_OPEN_EVENT)); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <HelpCircle className="h-4 w-4" />
                {isEn ? 'Start guided tour again' : 'Mở lại hướng dẫn từng bước'}
              </button>
              <button type="button" onClick={() => setHelpModalOpen(false)} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {isEn ? 'Close' : 'Đóng'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
