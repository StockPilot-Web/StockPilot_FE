import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Ban, Cpu, Globe, MonitorSmartphone, ShieldBan, UserPlus } from 'lucide-react';
import { useToast } from '../../../components/common/Toast';
import { formatVNDateTime } from '../../../services/adminService';
import {
  apiBlockDevice,
  apiBlockIp,
  apiGetDeviceBlocks,
  apiGetIpActivity,
  apiGetIpBlocks,
  apiUnblockDevice,
  apiUnblockIp,
} from '../../../services/adminOpsService';
import { getDeviceFingerprint, getDeviceId } from '../../../lib/deviceIdentity';
import { apiErrorMessage } from '../adminLabels';
import { adminStyles as ui } from '../adminStyles';
import { Badge, ConfirmDialog, EmptyState, ErrorState, PanelCard, TableBody, Td, Th } from '../components/AdminUI';
import { useAdminText } from '../useAdminText';
import { formatNumber, segmentedButton, segmentedWrapper, useOpsData } from './opsShared';

const KINDS = [
  { value: 'IP', icon: Globe, vi: 'Địa chỉ IP', en: 'IP address' },
  { value: 'DEVICE', icon: MonitorSmartphone, vi: 'Mã thiết bị', en: 'Device ID' },
  { value: 'FINGERPRINT', icon: Cpu, vi: 'Vân tay phần cứng', en: 'Hardware fingerprint' },
];

const DURATIONS = [
  { hours: null, vi: 'Vĩnh viễn', en: 'Permanent' },
  { hours: 24, vi: '24 giờ', en: '24 hours' },
  { hours: 168, vi: '7 ngày', en: '7 days' },
  { hours: 720, vi: '30 ngày', en: '30 days' },
];

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}(\/\d{1,2})?$/;
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;

function validate(kind, raw) {
  const value = raw.trim();
  if (!value) return 'empty';
  if (kind === 'IP') return IPV4.test(value) || (value.includes(':') && IPV6.test(value)) ? '' : 'ip';
  if (kind === 'DEVICE') return /^[a-z0-9-]{16,64}$/i.test(value) ? '' : 'device';
  return /^[a-f0-9]{32,64}$/i.test(value) ? '' : 'fingerprint';
}

const short = (value, n = 10) => (value && value.length > n + 2 ? `${value.slice(0, n)}…` : value || '–');

/** Mã dài hiển thị gọn, di chuột xem đủ. */
function Code({ value, n }) {
  if (!value) return <span className="text-slate-400">–</span>;
  return (
    <span className="font-mono text-[12px] text-slate-700" title={value}>
      {short(value, n)}
    </span>
  );
}

/** /admin/security?tab=blocks — chặn IP, mã thiết bị và vân tay phần cứng; xem ai đang tạo tài khoản rác. */
export function OpsAccessBlockPanel() {
  const { t } = useAdminText();
  const { toast } = useToast();

  const ipBlocks = useOpsData(() => apiGetIpBlocks(), []);
  const deviceBlocks = useOpsData(() => apiGetDeviceBlocks(), []);
  const activity = useOpsData(() => apiGetIpActivity({ hours: 24, minutes: 60, limit: 20 }), []);

  const [kind, setKind] = useState('IP');
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [duration, setDuration] = useState(null);
  const [pendingBlock, setPendingBlock] = useState(null); // { kind, value, hours, context }
  const [pendingUnblock, setPendingUnblock] = useState(null); // { kind, id, value }
  const [myFingerprint, setMyFingerprint] = useState(null);

  useEffect(() => {
    getDeviceFingerprint().then(setMyFingerprint);
  }, []);

  const reloadAll = () => {
    ipBlocks.reload();
    deviceBlocks.reload();
    activity.reload();
  };

  const kindLabel = (k) => {
    const item = KINDS.find((x) => x.value === k);
    return item ? t(item.vi, item.en) : k;
  };

  // Danh từ dùng giữa câu ("Chặn địa chỉ IP …"), giữ đúng chữ hoa của "IP".
  const kindNoun = (k) =>
    ({ IP: t('địa chỉ IP', 'IP address'), DEVICE: t('mã thiết bị', 'device ID'), FINGERPRINT: t('vân tay phần cứng', 'hardware fingerprint') })[k] || k;

  const formError = validate(kind, value);
  const formErrorText = {
    empty: t('Vui lòng nhập giá trị cần chặn.', 'Enter a value to block.'),
    ip: t('IP không hợp lệ. Ví dụ: 191.202.93.97 hoặc dải 191.202.93.0/24', 'Invalid IP. e.g. 191.202.93.97 or 191.202.93.0/24'),
    device: t('Mã thiết bị gồm 16–64 ký tự chữ, số hoặc dấu gạch ngang.', 'A device ID has 16–64 letters, digits or dashes.'),
    fingerprint: t('Vân tay phần cứng là chuỗi hex 32–64 ký tự.', 'A hardware fingerprint is a 32–64 character hex string.'),
  }[formError];

  const rows = useMemo(() => {
    const ip = (ipBlocks.data?.entries || []).map((e) => ({ ...e, kind: 'IP', value: e.cidr }));
    const env = (ipBlocks.data?.envEntries || []).map((cidr) => ({ id: `env-${cidr}`, kind: 'IP', value: cidr, env: true, active: true }));
    const dev = deviceBlocks.data?.entries || [];
    return [...env, ...ip, ...dev].sort((a, b) => Number(b.active) - Number(a.active) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [ipBlocks.data, deviceBlocks.data]);

  const isBlocked = (k, v) => rows.some((r) => r.active && r.kind === k && r.value === v);

  const submitBlock = async ({ reason }) => {
    const { kind: k, value: v, hours } = pendingBlock;
    try {
      if (k === 'IP') await apiBlockIp({ ip: v, reason, expiresInHours: hours });
      else await apiBlockDevice({ kind: k, value: v, reason, expiresInHours: hours });
      toast({
        type: 'success',
        title: t(`Đã chặn ${kindNoun(k)}`, `${kindLabel(k)} blocked`),
        description: hours ? t(`Hiệu lực ${hours} giờ.`, `For ${hours} hours.`) : t('Chặn vĩnh viễn — có hiệu lực ngay.', 'Permanent — effective immediately.'),
      });
      setPendingBlock(null);
      if (pendingBlock.context === 'form') {
        setValue('');
        setTouched(false);
      }
      reloadAll();
    } catch (err) {
      toast({ type: 'error', title: t('Không chặn được', 'Could not block'), description: apiErrorMessage(err) });
    }
  };

  const submitUnblock = async ({ reason }) => {
    try {
      if (pendingUnblock.kind === 'IP') await apiUnblockIp(pendingUnblock.id, reason);
      else await apiUnblockDevice(pendingUnblock.id, reason);
      toast({ type: 'success', title: t('Đã gỡ chặn', 'Unblocked'), description: pendingUnblock.value });
      setPendingUnblock(null);
      reloadAll();
    } catch (err) {
      toast({ type: 'error', title: t('Không gỡ chặn được', 'Could not unblock'), description: apiErrorMessage(err) });
    }
  };

  const quickButton = (k, v, label, context) =>
    v && !isBlocked(k, v) ? (
      <button type="button" className={`${ui.btnSecondary} h-7 px-2 text-[12px]`} onClick={() => setPendingBlock({ kind: k, value: v, hours: null, context })}>
        <Ban className="w-3.5 h-3.5" aria-hidden="true" /> {label}
      </button>
    ) : null;

  const listError = ipBlocks.error || deviceBlocks.error;
  const signups = activity.data?.audit?.recentSignups || [];
  const liveTop = activity.data?.live?.top || [];

  return (
    <div className="space-y-4">
      {/* ── Chặn mới ───────────────────────────────────────────── */}
      <PanelCard
        icon={ShieldBan}
        title={t('Chặn truy cập', 'Block access')}
        description={t(
          'Yêu cầu từ IP hoặc thiết bị bị chặn sẽ bị từ chối ngay ở máy chủ (lỗi 403), áp dụng cho mọi tài khoản. Mọi thao tác được ghi vào nhật ký kiểm toán.',
          'Requests from a blocked IP or device are rejected by the server (403) for every account. Every action is written to the audit log.'
        )}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!formError) setPendingBlock({ kind, value: value.trim(), hours: duration, context: 'form' });
          }}
        >
          <div className={`${segmentedWrapper} flex-wrap`} role="group" aria-label={t('Loại chặn', 'Block type')}>
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                className={`${segmentedButton(kind === k.value)} whitespace-nowrap`}
                onClick={() => {
                  setKind(k.value);
                  setTouched(false);
                }}
              >
                <k.icon className="w-3.5 h-3.5 inline -mt-0.5 mr-1" aria-hidden="true" />
                {t(k.vi, k.en)}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-start">
            <label className="block">
              <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{kindLabel(kind)}</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={kind === 'IP' ? '191.202.93.97' : kind === 'DEVICE' ? 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx' : 'a3f9…(64 ký tự hex)'}
                className={`${ui.input} font-mono`}
                aria-invalid={touched && Boolean(formError)}
                aria-describedby="block-value-hint"
              />
              <span id="block-value-hint" className={`block text-[12px] mt-1.5 ${touched && formError ? 'text-red-700' : 'text-slate-500'}`}>
                {touched && formError
                  ? formErrorText
                  : kind === 'IP'
                    ? t('Một IP hoặc dải CIDR (tối thiểu /16). Kẻ phá có thể đổi IP — nên chặn cả thiết bị.', 'One IP or a CIDR range (at least /16). Attackers can change IP — block the device too.')
                    : kind === 'DEVICE'
                      ? t('Chặn đúng một trình duyệt. Mất hiệu lực nếu họ xóa dữ liệu trình duyệt.', 'Blocks one exact browser. Lost if they clear browser data.')
                      : t('Tính từ GPU, màn hình, CPU, RAM… Vẫn chặn được sau khi xóa dữ liệu, nhưng có thể trùng máy khác cùng cấu hình.', 'Derived from GPU, screen, CPU, RAM… Survives clearing browser data but may match identical machines.')}
              </span>
            </label>
            <label className="block">
              <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{t('Thời hạn', 'Duration')}</span>
              <select
                value={duration === null ? '' : String(duration)}
                onChange={(e) => setDuration(e.target.value === '' ? null : Number(e.target.value))}
                className={ui.select}
              >
                {DURATIONS.map((d) => (
                  <option key={d.vi} value={d.hours === null ? '' : String(d.hours)}>
                    {t(d.vi, d.en)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={`${ui.btnDanger} sm:mt-[26px]`}>
              <Ban className="w-3.5 h-3.5" aria-hidden="true" /> {t('Chặn', 'Block')}
            </button>
          </div>
        </form>
        <p className="mt-4 text-[12px] text-slate-500">
          {t('Thiết bị của bạn (không thể tự chặn): ', 'Your device (cannot be self-blocked): ')}
          <Code value={getDeviceId()} n={13} /> · <Code value={myFingerprint} n={13} />
        </p>
      </PanelCard>

      {/* ── Đang chặn ─────────────────────────────────────────── */}
      <PanelCard
        icon={Ban}
        title={t('Danh sách đang chặn', 'Current blocks')}
        actions={
          <span className="text-[12px] text-slate-500">
            {t(`${formatNumber(rows.filter((r) => r.active).length)} mục đang hiệu lực`, `${formatNumber(rows.filter((r) => r.active).length)} active`)}
          </span>
        }
        bodyClassName="overflow-x-auto relative"
      >
        {listError ? (
          <ErrorState message={listError} onRetry={reloadAll} />
        ) : !ipBlocks.loading && !deviceBlocks.loading && rows.length === 0 ? (
          <EmptyState title={t('Chưa chặn IP hay thiết bị nào', 'Nothing is blocked')} description={t('Dùng form phía trên hoặc nút Chặn ở bảng hoạt động bên dưới.', 'Use the form above or the Block buttons in the activity tables below.')} />
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <Th>{t('Loại', 'Type')}</Th>
                <Th>{t('Giá trị', 'Value')}</Th>
                <Th>{t('Lý do', 'Reason')}</Th>
                <Th>{t('Ngày chặn', 'Blocked at')}</Th>
                <Th>{t('Thời hạn', 'Expires')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('Thao tác', 'Actions')}</span>
                </Th>
              </tr>
            </thead>
            <TableBody loading={ipBlocks.loading || deviceBlocks.loading} columns={6}>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className={`${ui.tr} ${r.active ? '' : 'opacity-60'}`}>
                  <Td>
                    <Badge tone={r.kind === 'IP' ? 'info' : r.kind === 'DEVICE' ? 'purple' : 'warning'}>{kindLabel(r.kind)}</Badge>
                  </Td>
                  <Td>
                    <Code value={r.value} n={20} />
                  </Td>
                  <Td>
                    <span className="block max-w-[260px] truncate" title={r.reason}>
                      {r.env ? t('Cấu hình máy chủ (BLOCKED_IPS)', 'Server config (BLOCKED_IPS)') : r.reason || '–'}
                    </span>
                  </Td>
                  <Td className="tabular-nums">{r.createdAt ? formatVNDateTime(r.createdAt) : '–'}</Td>
                  <Td>
                    {!r.active ? (
                      <Badge tone="neutral">{t('Đã hết hạn', 'Expired')}</Badge>
                    ) : r.expiresAt ? (
                      <span className="tabular-nums">{formatVNDateTime(r.expiresAt)}</span>
                    ) : (
                      <Badge tone="danger">{t('Vĩnh viễn', 'Permanent')}</Badge>
                    )}
                  </Td>
                  <Td align="right">
                    {r.active && !r.env && (
                      <button type="button" className={`${ui.btnSecondary} h-8`} onClick={() => setPendingUnblock({ kind: r.kind, id: r.id, value: r.value })}>
                        {t('Gỡ chặn', 'Unblock')}
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </TableBody>
          </table>
        )}
      </PanelCard>

      {/* ── Đăng ký gần đây ───────────────────────────────────── */}
      <PanelCard
        icon={UserPlus}
        title={t('Tài khoản đăng ký trong 24 giờ qua', 'Sign-ups in the last 24 hours')}
        description={t('Kèm IP và thiết bị đã tạo ra từng cửa hàng — chặn tận gốc kẻ tạo tài khoản rác.', 'With the IP and device behind each new store — block junk sign-ups at the source.')}
        actions={
          <button type="button" className={`${ui.btnSecondary} h-8`} onClick={activity.reload} disabled={activity.loading}>
            {t('Làm mới', 'Refresh')}
          </button>
        }
        bodyClassName="overflow-x-auto relative"
      >
        {activity.error ? (
          <ErrorState message={activity.error} onRetry={activity.reload} />
        ) : !activity.loading && signups.length === 0 ? (
          <EmptyState title={t('Không có đăng ký mới trong 24 giờ qua', 'No sign-ups in the last 24 hours')} />
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <Th>{t('Thời gian', 'Time')}</Th>
                <Th>{t('Cửa hàng / Email', 'Store / Email')}</Th>
                <Th>IP</Th>
                <Th>{t('Thiết bị', 'Device')}</Th>
                <Th>{t('Vân tay', 'Fingerprint')}</Th>
                <Th align="right">{t('Chặn vĩnh viễn', 'Block permanently')}</Th>
              </tr>
            </thead>
            <TableBody loading={activity.loading} columns={6}>
              {signups.map((s, i) => (
                <tr key={`${s.createdAt}-${i}`} className={ui.tr}>
                  <Td className="tabular-nums whitespace-nowrap">{formatVNDateTime(s.createdAt)}</Td>
                  <Td>
                    <p className="font-medium text-slate-900">{s.store?.name || t('(cửa hàng đã xóa)', '(store deleted)')}</p>
                    <p className="text-[12px] text-slate-500">{s.user?.email || '–'}</p>
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">{s.ipAddress || '–'}</span>
                    {s.isBlocked && (
                      <Badge tone="danger" className="ml-1.5">
                        {t('Đã chặn', 'Blocked')}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Code value={s.deviceId} />
                    {s.deviceBlockedBy === 'DEVICE' && (
                      <Badge tone="danger" className="ml-1.5">
                        {t('Đã chặn', 'Blocked')}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Code value={s.fingerprint} />
                    {s.deviceBlockedBy === 'FINGERPRINT' && (
                      <Badge tone="danger" className="ml-1.5">
                        {t('Đã chặn', 'Blocked')}
                      </Badge>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {quickButton('IP', s.ipAddress, 'IP', 'signup')}
                      {quickButton('DEVICE', s.deviceId, t('Thiết bị', 'Device'), 'signup')}
                      {quickButton('FINGERPRINT', s.fingerprint, t('Vân tay', 'Fingerprint'), 'signup')}
                    </div>
                  </Td>
                </tr>
              ))}
            </TableBody>
          </table>
        )}
      </PanelCard>

      {/* ── IP truy cập nhiều nhất ───────────────────────────── */}
      <PanelCard
        icon={Activity}
        title={t('IP truy cập nhiều nhất (60 phút)', 'Busiest IPs (last 60 minutes)')}
        description={t('Số liệu từ bộ nhớ máy chủ, đặt lại khi khởi động lại.', 'From server memory; resets on restart.')}
        bodyClassName="overflow-x-auto relative"
      >
        {!activity.loading && liveTop.length === 0 ? (
          <EmptyState title={t('Chưa có dữ liệu', 'No data yet')} />
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <Th>IP</Th>
                <Th align="right">{t('Yêu cầu', 'Requests')}</Th>
                <Th align="right">{t('Lỗi 4xx', '4xx')}</Th>
                <Th align="right">{t('Bị giới hạn', 'Rate-limited')}</Th>
                <Th align="right">{t('Gọi đăng ký', 'Sign-up calls')}</Th>
                <Th>{t('Thiết bị', 'Devices')}</Th>
                <Th>{t('Lần cuối', 'Last seen')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('Thao tác', 'Actions')}</span>
                </Th>
              </tr>
            </thead>
            <TableBody loading={activity.loading} columns={8}>
              {liveTop.map((row) => (
                <tr key={row.ip} className={ui.tr}>
                  <Td>
                    <span className="font-mono text-[12px]">{row.ip}</span>
                    {row.isBlocked && (
                      <Badge tone="danger" className="ml-1.5">
                        {t('Đã chặn', 'Blocked')}
                      </Badge>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums">{formatNumber(row.requests)}</Td>
                  <Td align="right" className="tabular-nums">{formatNumber(row.clientErrors)}</Td>
                  <Td align="right" className="tabular-nums">{formatNumber(row.rateLimited)}</Td>
                  <Td align="right" className="tabular-nums">{formatNumber(row.signupRequests)}</Td>
                  <Td>{formatNumber(row.deviceIds?.length || 0)}</Td>
                  <Td className="tabular-nums whitespace-nowrap">
                    <span title={row.lastPath}>{formatVNDateTime(row.lastSeen)}</span>
                  </Td>
                  <Td align="right">{quickButton('IP', row.ip, t('Chặn IP', 'Block IP'), 'live')}</Td>
                </tr>
              ))}
            </TableBody>
          </table>
        )}
      </PanelCard>

      {pendingBlock && (
        <ConfirmDialog
          danger
          title={t(`Chặn ${kindNoun(pendingBlock.kind)} ${short(pendingBlock.value, 24)}?`, `Block ${kindNoun(pendingBlock.kind)} ${short(pendingBlock.value, 24)}?`)}
          description={
            pendingBlock.hours
              ? t(`Mọi yêu cầu từ ${kindNoun(pendingBlock.kind)} này bị từ chối trong ${pendingBlock.hours} giờ.`, `All requests from this ${kindNoun(pendingBlock.kind)} are rejected for ${pendingBlock.hours} hours.`)
              : t(
                  `Chặn VĨNH VIỄN: mọi yêu cầu từ ${kindNoun(pendingBlock.kind)} này bị từ chối ngay, cho đến khi quản trị viên gỡ chặn.`,
                  `PERMANENT: every request from this ${kindNoun(pendingBlock.kind)} is rejected until an admin unblocks it.`
                )
          }
          confirmLabel={t('Chặn', 'Block')}
          reason={{ required: true, minLength: 3, placeholder: t('Ví dụ: Tạo hàng loạt cửa hàng rác bằng email @mailinator.com', 'e.g. Mass-created junk stores with @mailinator.com e-mails') }}
          onConfirm={submitBlock}
          onClose={() => setPendingBlock(null)}
        />
      )}

      {pendingUnblock && (
        <ConfirmDialog
          title={t(`Gỡ chặn ${short(pendingUnblock.value, 24)}?`, `Unblock ${short(pendingUnblock.value, 24)}?`)}
          description={t('Địa chỉ / thiết bị này sẽ truy cập lại được ngay.', 'This address / device can access the system again immediately.')}
          confirmLabel={t('Gỡ chặn', 'Unblock')}
          reason={{ required: true, minLength: 3, placeholder: t('Ví dụ: Chặn nhầm khách hàng thật', 'e.g. Blocked a real customer by mistake') }}
          onConfirm={submitUnblock}
          onClose={() => setPendingUnblock(null)}
        />
      )}
    </div>
  );
}
