import React, { useEffect, useState } from 'react';
import { AtSign, Loader2, Plus, UserPlus, X } from 'lucide-react';
import { useToast } from '../../../components/common/Toast';
import { apiGetAdminSettings, apiUpdateAdminSetting } from '../../../services/adminService';
import { apiGetSignupEmailPolicy, apiUpdateOpsSetting } from '../../../services/adminOpsService';
import { apiErrorMessage } from '../adminLabels';
import { Switch } from '../AdminSettingsPanel';
import { adminStyles as ui } from '../adminStyles';
import { Badge, ConfirmDialog, ErrorState, PanelCard } from '../components/AdminUI';
import { useAdminText } from '../useAdminText';
import { useOpsData } from './opsShared';

const BLOCKED_KEY = 'ops.signup.blockedEmailDomains';
const ALLOW_KEY = 'ops.signup.emailAllowlist';

/** Cùng quy tắc với backend (utils/email-domain.ts): khớp tên miền và mọi tên miền con. */
export const domainMatches = (domain, rule) => domain === rule || domain.endsWith(`.${rule}`);
export const emailDomainOf = (email) => (email && email.includes('@') ? email.slice(email.lastIndexOf('@') + 1).toLowerCase() : '');
const splitDomains = (text) =>
  text
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean);

/**
 * Thêm một tên miền vào danh sách chặn của admin. Đọc lại danh sách mới nhất ngay trước khi ghi để không
 * ghi đè thay đổi của người khác; backend chuẩn hóa, loại trùng và ghi nhật ký.
 */
export async function addBlockedEmailDomain(domain) {
  const policy = await apiGetSignupEmailPolicy();
  if (policy.adminBlocked.includes(domain)) return policy.adminBlocked;
  return apiUpdateOpsSetting(BLOCKED_KEY, [...policy.adminBlocked, domain]);
}

function Chip({ children, onRemove, removeLabel, disabled }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 pl-2 pr-1 py-0.5 text-[12px] font-mono text-slate-800">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={removeLabel} className="p-0.5 rounded hover:bg-slate-200 cursor-pointer disabled:opacity-40">
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Công tắc "Cho phép đăng ký tài khoản mới" — cùng setting `signup.enabled` với trang Hệ thống & AI → Cài đặt. */
export function SignupToggleCard() {
  const { t } = useAdminText();
  const { toast } = useToast();
  const settings = useOpsData(() => apiGetAdminSettings(), []);
  const [pending, setPending] = useState(null);
  const setting = (settings.data || []).find((s) => s.key === 'signup.enabled');
  const enabled = setting?.value === true;

  const apply = async () => {
    try {
      await apiUpdateAdminSetting('signup.enabled', pending);
      toast({
        type: 'success',
        title: pending ? t('Đã mở lại đăng ký', 'Sign-up re-opened') : t('Đã tắt đăng ký tài khoản mới', 'New sign-ups turned off'),
      });
      setPending(null);
      settings.reload();
    } catch (err) {
      toast({ type: 'error', title: t('Không lưu được', 'Could not save'), description: apiErrorMessage(err) });
    }
  };

  return (
    <PanelCard
      icon={UserPlus}
      title={t('Cho phép đăng ký tài khoản mới', 'Allow new sign-ups')}
      description={t(
        'Khi tắt, máy chủ từ chối mọi yêu cầu tạo cửa hàng mới (kể cả gọi thẳng API). Tài khoản đang có vẫn đăng nhập bình thường. Cùng cài đặt với Hệ thống & AI → Cài đặt.',
        'When off, the server rejects every new-store request (including direct API calls). Existing accounts still sign in. Same setting as System & AI → Settings.'
      )}
      actions={
        settings.loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" aria-label={t('Đang tải', 'Loading')} />
        ) : settings.error ? null : (
          <div className="flex items-center gap-3">
            <Badge tone={enabled ? 'success' : 'danger'}>{enabled ? t('Đang mở', 'Open') : t('Đang tắt', 'Closed')}</Badge>
            <Switch checked={enabled} onChange={(v) => setPending(v)} label={t('Cho phép đăng ký tài khoản mới', 'Allow new sign-ups')} />
          </div>
        )
      }
      bodyClassName={settings.error ? 'p-5' : 'hidden'}
    >
      {settings.error && <ErrorState message={settings.error} onRetry={settings.reload} />}
      {pending !== null && (
        <ConfirmDialog
          danger={!pending}
          title={pending ? t('Mở lại đăng ký tài khoản mới?', 'Re-open new sign-ups?') : t('Tắt đăng ký tài khoản mới?', 'Turn off new sign-ups?')}
          description={
            pending
              ? t('Mọi người lại có thể tự tạo cửa hàng (vẫn áp dụng chặn IP, thiết bị và tên miền email).', 'Anyone can create a store again (IP, device and e-mail domain blocks still apply).')
              : t('Trang đăng ký sẽ báo tạm ngừng nhận cửa hàng mới. Có hiệu lực ngay.', 'The sign-up page will say new stores are paused. Effective immediately.')
          }
          confirmLabel={pending ? t('Mở lại', 'Re-open') : t('Tắt đăng ký', 'Turn off')}
          onConfirm={apply}
          onClose={() => setPending(null)}
        />
      )}
    </PanelCard>
  );
}

/** Danh sách tên miền email bị chặn / chế độ chỉ cho phép — lưu trong system_settings, có hiệu lực ngay. */
export function EmailDomainPolicyCard({ reloadKey, onChanged }) {
  const { t } = useAdminText();
  const { toast } = useToast();
  const policy = useOpsData(() => apiGetSignupEmailPolicy(), [reloadKey]);
  const p = policy.data;
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [allowDraft, setAllowDraft] = useState(null); // { enabled, domains } khi đang sửa
  const [allowInput, setAllowInput] = useState('');
  const [showBuiltIn, setShowBuiltIn] = useState(false);

  useEffect(() => {
    if (p) setAllowDraft({ enabled: p.allowlist.enabled, domains: [...p.allowlist.domains] });
  }, [p]);

  const saveBlocked = async (next, message) => {
    setSaving(true);
    try {
      await apiUpdateOpsSetting(BLOCKED_KEY, next);
      toast({ type: 'success', title: message });
      setInput('');
      policy.reload();
      onChanged?.();
    } catch (err) {
      toast({ type: 'error', title: t('Không lưu được', 'Could not save'), description: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const addBlocked = () => {
    const items = splitDomains(input);
    if (!items.length || !p) return;
    saveBlocked([...p.adminBlocked, ...items], t(`Đã chặn ${items.join(', ')}`, `Blocked ${items.join(', ')}`));
  };

  const allowDirty = p && allowDraft && JSON.stringify(allowDraft) !== JSON.stringify(p.allowlist);
  const saveAllow = async () => {
    setSaving(true);
    try {
      await apiUpdateOpsSetting(ALLOW_KEY, allowDraft);
      toast({
        type: 'success',
        title: allowDraft.enabled ? t('Đã bật chế độ chỉ cho phép', 'Allow-list mode on') : t('Đã lưu danh sách cho phép', 'Allow list saved'),
      });
      policy.reload();
      onChanged?.();
    } catch (err) {
      toast({ type: 'error', title: t('Không lưu được', 'Could not save'), description: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };
  const addAllow = (items) =>
    setAllowDraft((d) => ({ ...d, domains: [...d.domains, ...items.filter((x) => !d.domains.includes(x))] }));

  return (
    <PanelCard
      icon={AtSign}
      title={t('Tên miền email khi đăng ký', 'E-mail domains at sign-up')}
      description={t(
        'Chặn tên miền email tạm/rác. Quy tắc khớp cả tên miền con (chặn "abc.com" thì chặn cả "x.abc.com", không chặn "notabc.com"). Chỉ ảnh hưởng lượt đăng ký mới, không đụng tới tài khoản đang có.',
        'Block disposable e-mail domains. A rule also matches subdomains ("abc.com" blocks "x.abc.com", not "notabc.com"). Only affects new sign-ups, never existing accounts.'
      )}
    >
      {policy.error ? (
        <ErrorState message={policy.error} onRetry={policy.reload} />
      ) : !p ? (
        <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[13px] font-semibold text-slate-900">
              {t(`Danh sách chặn của quản trị viên (${p.adminBlocked.length})`, `Admin block list (${p.adminBlocked.length})`)}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {p.adminBlocked.length === 0 && <span className="text-[12px] text-slate-500">{t('Chưa có tên miền nào.', 'No domains yet.')}</span>}
              {p.adminBlocked.map((d) => (
                <Chip
                  key={d}
                  disabled={saving}
                  removeLabel={t(`Bỏ chặn ${d}`, `Unblock ${d}`)}
                  onRemove={() => saveBlocked(p.adminBlocked.filter((x) => x !== d), t(`Đã bỏ chặn ${d}`, `Unblocked ${d}`))}
                >
                  {d}
                </Chip>
              ))}
            </div>
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addBlocked();
              }}
            >
              <label className="sr-only" htmlFor="block-domain-input">
                {t('Tên miền cần chặn', 'Domain to block')}
              </label>
              <input
                id="block-domain-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ooynib.com, euploading.com"
                className={`${ui.input} font-mono`}
              />
              <button type="submit" className={ui.btnSecondary} disabled={saving || !input.trim()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                {t('Chặn tên miền', 'Block domain')}
              </button>
            </form>
            <p className="text-[12px] text-slate-500">
              {t('Luôn bị chặn thêm: ', 'Always blocked as well: ')}
              <button type="button" className="text-blue-700 hover:underline cursor-pointer" onClick={() => setShowBuiltIn((v) => !v)}>
                {t(`${p.builtInBlocked.length} tên miền email tạm có sẵn`, `${p.builtInBlocked.length} built-in disposable domains`)}
              </button>
              {p.envBlocked.length > 0 && t(` và ${p.envBlocked.length} tên miền trong cấu hình máy chủ (SIGNUP_BLOCKED_EMAIL_DOMAINS)`, ` and ${p.envBlocked.length} from server config (SIGNUP_BLOCKED_EMAIL_DOMAINS)`)}
              .
            </p>
            {showBuiltIn && (
              <div className="flex flex-wrap gap-1.5">
                {[...p.builtInBlocked, ...p.envBlocked].map((d) => (
                  <Chip key={d}>{d}</Chip>
                ))}
              </div>
            )}
          </section>

          {allowDraft && (
            <section className="space-y-2 border-t border-slate-200 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-[13px] font-semibold text-slate-900">{t('Chỉ cho đăng ký bằng các tên miền email được cho phép', 'Only allow sign-ups from allowed e-mail domains')}</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {t(
                      'Hạn chế đăng ký theo tên miền; không bảo đảm loại bỏ hoàn toàn tài khoản rác (vẫn tạo được Gmail mới). Danh sách chặn luôn được ưu tiên.',
                      'Restricts sign-up by domain; it does not guarantee zero junk accounts (new Gmail accounts are easy). The block list always wins.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={allowDraft.enabled}
                  disabled={!allowDraft.enabled && allowDraft.domains.length === 0}
                  onChange={(v) => setAllowDraft((d) => ({ ...d, enabled: v }))}
                  label={t('Bật chế độ chỉ cho phép', 'Enable allow-list mode')}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allowDraft.domains.length === 0 && (
                  <span className="text-[12px] text-slate-500">{t('Danh sách trống — thêm ít nhất 1 tên miền để bật.', 'Empty — add at least one domain to enable.')}</span>
                )}
                {allowDraft.domains.map((d) => (
                  <Chip
                    key={d}
                    removeLabel={t(`Bỏ ${d}`, `Remove ${d}`)}
                    onRemove={() =>
                      setAllowDraft((x) => {
                        const domains = x.domains.filter((y) => y !== d);
                        return { enabled: x.enabled && domains.length > 0, domains };
                      })
                    }
                  >
                    {d}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="sr-only" htmlFor="allow-domain-input">
                  {t('Tên miền được phép', 'Allowed domain')}
                </label>
                <input
                  id="allow-domain-input"
                  value={allowInput}
                  onChange={(e) => setAllowInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAllow(splitDomains(allowInput));
                      setAllowInput('');
                    }
                  }}
                  placeholder="gmail.com"
                  className={`${ui.input} font-mono`}
                />
                <button
                  type="button"
                  className={ui.btnSecondary}
                  disabled={!allowInput.trim()}
                  onClick={() => {
                    addAllow(splitDomains(allowInput));
                    setAllowInput('');
                  }}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t('Thêm', 'Add')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                {t('Gợi ý:', 'Suggestions:')}
                {p.suggestedAllowlist
                  .filter((d) => !allowDraft.domains.includes(d))
                  .map((d) => (
                    <button key={d} type="button" className="rounded-md border border-slate-200 px-2 py-0.5 font-mono hover:bg-slate-50 cursor-pointer" onClick={() => addAllow([d])}>
                      + {d}
                    </button>
                  ))}
              </div>
              {allowDirty && (
                <div className="flex justify-end gap-2">
                  <button type="button" className={ui.btnSecondary} onClick={() => setAllowDraft({ ...p.allowlist, domains: [...p.allowlist.domains] })} disabled={saving}>
                    {t('Hoàn tác', 'Discard')}
                  </button>
                  <button type="button" className={ui.btnPrimary} onClick={saveAllow} disabled={saving || (allowDraft.enabled && allowDraft.domains.length === 0)}>
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                    {t('Lưu danh sách cho phép', 'Save allow list')}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </PanelCard>
  );
}
