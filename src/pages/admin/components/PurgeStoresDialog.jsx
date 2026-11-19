import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCw, Trash2, XCircle } from 'lucide-react';
import { apiBlockDevice, apiBlockIp, apiPurgeStores } from '../../../services/adminOpsService';
import { apiErrorMessage } from '../adminLabels';
import { adminStyles as ui } from '../adminStyles';
import { useAdminText } from '../useAdminText';
import { Badge, ErrorState, Modal } from './AdminUI';

/** Lỗi có phản hồi từ máy chủ → thông điệp của máy chủ; mất kết nối → câu tiếng Việt dễ hiểu. */
const errorText = (err, t) =>
  err?.response ? apiErrorMessage(err) : t('Không kết nối được máy chủ. Vui lòng thử lại.', 'Cannot reach the server. Please try again.');

const short = (v, n = 12) => (v && v.length > n + 2 ? `${v.slice(0, n)}…` : v);

function Code({ value, n = 12 }) {
  return (
    <span className="font-mono text-[12px] text-slate-700" title={value}>
      {short(value, n)}
    </span>
  );
}

/** IP / thiết bị / vân tay ghi nhận lúc tạo cửa hàng (nhật ký STORE_REGISTERED). */
function CreatorCell({ creator, t }) {
  if (!creator) return <span className="text-[12px] text-slate-500">{t('Không có dữ liệu', 'No data')}</span>;
  const none = <span className="text-slate-500">{t('không có', 'none')}</span>;
  return (
    <div className="space-y-0.5 text-[12px] leading-5">
      <div>IP: {creator.ipAddress ? <Code value={creator.ipAddress} n={40} /> : none}</div>
      <div>
        {t('Thiết bị', 'Device')}: {creator.deviceId ? <Code value={creator.deviceId} /> : none}
      </div>
      <div>
        {t('Vân tay', 'Fingerprint')}: {creator.fingerprint ? <Code value={creator.fingerprint} /> : none}
      </div>
    </div>
  );
}

const KIND_LABEL = { IP: ['IP', 'IP'], DEVICE: ['Mã thiết bị', 'Device ID'], FINGERPRINT: ['Vân tay phần cứng', 'Hardware fingerprint'] };

/**
 * Xóa vĩnh viễn cửa hàng rác — dùng chung cho trang Cửa hàng và Người dùng.
 * Bước 1: xem trước (backend dryRun quyết định shop nào xóa được). Bước 2: lý do + mật khẩu.
 * Bước 3: kết quả (xóa / bỏ qua / thất bại, chặn IP-thiết bị nếu có chọn, thử chặn lại phần lỗi).
 * Mật khẩu chỉ nằm trong state của hộp thoại, xóa ngay sau khi gửi; không ghi log hay lưu trữ.
 *
 * @param {number[]} storeIds  cửa hàng cần xử lý (đã loại trùng)
 * @param {React.ReactNode} [context]  ghi chú nguồn chọn (ví dụ: số người đã chọn → số cửa hàng)
 * @param {() => void} onClose
 * @param {(result) => void} onDone  gọi sau khi đã gửi lệnh xóa (thành công, một phần hoặc lỗi) để trang làm mới
 */
export function PurgeStoresDialog({ storeIds, context, onClose, onDone }) {
  const { t } = useAdminText();
  const [step, setStep] = useState('preview'); // preview | confirm | result
  const [preview, setPreview] = useState({ loading: true, error: '', data: null });
  const [blockCreators, setBlockCreators] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const sending = useRef(false);

  const loadPreview = async () => {
    setPreview({ loading: true, error: '', data: null });
    try {
      const data = await apiPurgeStores({ storeIds, dryRun: true });
      setPreview({ loading: false, error: '', data });
    } catch (err) {
      setPreview({ loading: false, error: errorText(err, t), data: null });
    }
  };

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deletable = useMemo(() => (preview.data?.results || []).filter((r) => r.status === 'DELETABLE'), [preview.data]);
  const notDeletable = useMemo(() => (preview.data?.results || []).filter((r) => r.status !== 'DELETABLE'), [preview.data]);
  const targets = preview.data?.creatorTargets || [];
  const countKind = (k) => targets.filter((x) => x.kind === k).length;
  const sharedIps = targets.filter((x) => x.kind === 'IP' && x.storeIds.length > 1).length;
  const reasonOk = reason.trim().length >= 3;
  const n = deletable.length;

  const submit = async () => {
    if (sending.current || !reasonOk || !password || n === 0) return;
    sending.current = true;
    setBusy(true);
    setSubmitError('');
    const pw = password;
    setPassword('');
    try {
      const data = await apiPurgeStores({
        storeIds: deletable.map((d) => d.storeId),
        reason: reason.trim(),
        actorPassword: pw,
        blockCreators,
      });
      setResult(data);
      setStep('result');
      onDone?.(data);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403 || status === 400) {
        // Sai mật khẩu / dữ liệu không hợp lệ: backend chưa xóa gì.
        setSubmitError(apiErrorMessage(err));
      } else {
        // Mất kết nối / lỗi máy chủ: không chắc phần nào đã xóa — làm mới danh sách để xem trạng thái thật.
        setSubmitError(
          `${errorText(err, t)} ${t('Không xác định được kết quả — danh sách đã được làm mới, hãy kiểm tra lại.', 'Result unknown — the list was refreshed, please check.')}`
        );
        onDone?.(null);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  /** Thử chặn lại các IP/thiết bị bị lỗi ở lần trước, bằng API chặn thủ công sẵn có. */
  const retryFailedBlocks = async () => {
    if (retrying) return;
    setRetrying(true);
    const results = [...result.blocks.results];
    for (let i = 0; i < results.length; i += 1) {
      const r = results[i];
      if (r.status !== 'FAILED') continue;
      try {
        if (r.kind === 'IP') await apiBlockIp({ ip: r.value, reason: `Tạo cửa hàng rác đã xóa: ${reason.trim()}`, expiresInHours: null });
        else await apiBlockDevice({ kind: r.kind, value: r.value, reason: `Tạo cửa hàng rác đã xóa: ${reason.trim()}`, expiresInHours: null });
        results[i] = { ...r, status: 'BLOCKED', reason: undefined };
      } catch (err) {
        const msg = apiErrorMessage(err);
        results[i] = { ...r, status: err?.response?.status === 409 && /đã có/.test(msg) ? 'ALREADY_BLOCKED' : 'FAILED', reason: msg };
      }
    }
    setResult({
      ...result,
      blocks: {
        results,
        blocked: results.filter((r) => r.status === 'BLOCKED').length,
        alreadyBlocked: results.filter((r) => r.status === 'ALREADY_BLOCKED').length,
        failed: results.filter((r) => r.status === 'FAILED').length,
      },
    });
    setRetrying(false);
  };

  const close = () => {
    if (!busy) onClose();
  };

  // ── Bước 1: xem trước ─────────────────────────────────────────
  if (step === 'preview') {
    return (
      <Modal
        width="max-w-3xl"
        title={t('Xóa vĩnh viễn cửa hàng rác — xem trước', 'Permanently delete junk stores — preview')}
        description={t(
          'Máy chủ kiểm tra từng cửa hàng: chỉ cửa hàng chưa phát sinh dữ liệu thật mới xóa được. Chưa có gì bị xóa ở bước này.',
          'The server checks each store: only stores without real business data can be deleted. Nothing is deleted at this step.'
        )}
        onClose={close}
        footer={
          <>
            <button type="button" className={ui.btnSecondary} onClick={close}>
              {t('Hủy', 'Cancel')}
            </button>
            <button type="button" className={ui.btnDanger} disabled={preview.loading || n === 0} onClick={() => setStep('confirm')}>
              {t(`Tiếp tục với ${n} cửa hàng`, `Continue with ${n} stores`)}
            </button>
          </>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {context && <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[12px] text-slate-600">{context}</div>}
          {preview.loading ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t('Đang kiểm tra…', 'Checking…')}
            </div>
          ) : preview.error ? (
            <ErrorState message={preview.error} onRetry={loadPreview} />
          ) : (
            <>
              <section>
                <h4 className="text-[13px] font-semibold text-slate-900 mb-2">
                  {t(`Xóa được (${n})`, `Can be deleted (${n})`)}
                </h4>
                {n === 0 ? (
                  <p className="text-[13px] text-slate-600 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    {t(
                      'Không có cửa hàng nào xóa được. Các cửa hàng đã có dữ liệu thật chỉ có thể tạm ngưng.',
                      'No store can be deleted. Stores with real data can only be suspended.'
                    )}
                  </p>
                ) : (
                  <div className="overflow-x-auto relative rounded-lg border border-slate-200">
                    <table className={ui.table}>
                      <thead>
                        <tr>
                          <th className={ui.th}>{t('Cửa hàng', 'Store')}</th>
                          <th className={ui.th}>{t('Tài khoản bị xóa', 'Accounts deleted')}</th>
                          <th className={ui.th}>{t('Tạo bởi (lúc đăng ký)', 'Created from (at sign-up)')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletable.map((r) => (
                          <tr key={r.storeId} className={ui.tr}>
                            <td className={ui.td}>
                              <p className="font-medium text-slate-900">{r.name}</p>
                              <p className="text-[12px] text-slate-500 font-mono">{r.code}</p>
                            </td>
                            <td className={`${ui.td} text-[12px]`}>{(r.users || []).map((u) => u.email).join(', ') || '–'}</td>
                            <td className={ui.td}>
                              <CreatorCell creator={r.creator} t={t} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {notDeletable.length > 0 && (
                <section>
                  <h4 className="text-[13px] font-semibold text-slate-900 mb-2">
                    {t(`Bỏ qua (${notDeletable.length})`, `Skipped (${notDeletable.length})`)}
                  </h4>
                  <ul className="space-y-1.5">
                    {notDeletable.map((r) => (
                      <li key={r.storeId} className="text-[13px] flex flex-wrap gap-x-2">
                        <span className="font-medium text-slate-900">{r.name || `#${r.storeId}`}</span>
                        <span className="text-slate-600">— {r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {n > 0 && (
                <section className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer" htmlFor="purge-block-creators">
                    <input
                      id="purge-block-creators"
                      type="checkbox"
                      checked={blockCreators}
                      onChange={(e) => setBlockCreators(e.target.checked)}
                      disabled={targets.length === 0}
                      className="mt-0.5 w-4 h-4 accent-red-600"
                    />
                    <span className="text-[13px] text-slate-800 font-medium">
                      {t('Chặn vĩnh viễn các IP/thiết bị đã tạo những cửa hàng sẽ xóa', 'Permanently block the IPs/devices that created the stores being deleted')}
                    </span>
                  </label>
                  {targets.length === 0 ? (
                    <p className="text-[12px] text-slate-500 pl-6">
                      {t('Không có dữ liệu IP/thiết bị lúc đăng ký cho các cửa hàng này.', 'No sign-up IP/device data for these stores.')}
                    </p>
                  ) : (
                    <div className="pl-6 space-y-1.5 text-[12px] text-slate-600">
                      <p>
                        {t(
                          `Sẽ chặn ${countKind('IP')} IP, ${countKind('DEVICE')} mã thiết bị, ${countKind('FINGERPRINT')} vân tay phần cứng (đã loại trùng):`,
                          `Will block ${countKind('IP')} IPs, ${countKind('DEVICE')} device IDs, ${countKind('FINGERPRINT')} hardware fingerprints (de-duplicated):`
                        )}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {targets.map((x) => (
                          <li key={`${x.kind}-${x.value}`} className="rounded-md bg-slate-100 px-2 py-0.5">
                            {t(KIND_LABEL[x.kind][0], KIND_LABEL[x.kind][1])}: <Code value={x.value} n={x.kind === 'IP' ? 40 : 10} />
                            {x.storeIds.length > 1 && <span className="text-slate-500"> ×{x.storeIds.length}</span>}
                          </li>
                        ))}
                      </ul>
                      <p className="flex items-start gap-1.5 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        {t(
                          'IP có thể dùng chung (wifi quán, công ty, nhà mạng di động): chặn IP có thể chặn cả người dùng thật khác. Vân tay phần cứng có thể trùng máy cùng cấu hình. Chỉ chặn đối tượng của cửa hàng xóa thành công.',
                          'IPs can be shared (cafés, offices, mobile carriers): blocking an IP may block other real users. Hardware fingerprints can match identical machines. Only creators of successfully deleted stores are blocked.'
                        )}
                        {sharedIps > 0 && t(` ${sharedIps} IP đã tạo nhiều cửa hàng.`, ` ${sharedIps} IPs created several stores.`)}
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </Modal>
    );
  }

  // ── Bước 2: xác nhận ──────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <Modal
        width="max-w-lg"
        title={t(`Xóa vĩnh viễn ${n} cửa hàng?`, `Permanently delete ${n} stores?`)}
        description={t(
          'Không thể hoàn tác. Cửa hàng, tài khoản, sản phẩm và mọi dữ liệu của các cửa hàng này bị xóa hẳn. Nhật ký kiểm toán được giữ lại.',
          'This cannot be undone. The stores, their accounts, products and all their data are deleted. The audit log is kept.'
        )}
        onClose={close}
        busy={busy}
        footer={
          <>
            <button type="button" className={ui.btnSecondary} onClick={() => setStep('preview')} disabled={busy} autoFocus>
              {t('Quay lại', 'Back')}
            </button>
            <button type="button" className={ui.btnDanger} onClick={submit} disabled={busy || !reasonOk || !password}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
              {t(`Xóa vĩnh viễn ${n} cửa hàng`, `Permanently delete ${n} stores`)}
            </button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {deletable.map((d) => d.name).join(', ')}
              {blockCreators && t(' · Kèm chặn vĩnh viễn IP/thiết bị đã tạo các cửa hàng này.', ' · Their creating IPs/devices will be blocked permanently.')}
            </span>
          </div>
          <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{t('Lý do', 'Reason')}</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('Ví dụ: Tạo hàng loạt bằng email tạm, không có dữ liệu thật', 'e.g. Mass-created with disposable e-mails, no real data')}
              className={ui.input}
              disabled={busy}
            />
            <span className="block text-[12px] text-slate-500 mt-1">{t('Ít nhất 3 ký tự. Ghi vào nhật ký kiểm toán.', 'At least 3 characters. Recorded in the audit log.')}</span>
          </label>
          <label className="block">
            <span className="block text-[13px] font-medium text-slate-700 mb-1.5">{t('Mật khẩu quản trị viên', 'Your admin password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={ui.input}
              disabled={busy}
            />
          </label>
          {submitError && (
            <p role="alert" className="text-[13px] text-red-700">
              {submitError}
            </p>
          )}
        </form>
      </Modal>
    );
  }

  // ── Bước 3: kết quả ───────────────────────────────────────────
  const statusBadge = (s) =>
    ({
      DELETED: <Badge tone="success">{t('Đã xóa', 'Deleted')}</Badge>,
      SKIPPED: <Badge tone="warning">{t('Bỏ qua', 'Skipped')}</Badge>,
      NOT_FOUND: <Badge tone="neutral">{t('Không còn tồn tại', 'Not found')}</Badge>,
      FAILED: <Badge tone="danger">{t('Thất bại', 'Failed')}</Badge>,
    })[s] || <Badge>{s}</Badge>;
  const blockBadge = (s) =>
    ({
      BLOCKED: <Badge tone="success">{t('Đã chặn', 'Blocked')}</Badge>,
      ALREADY_BLOCKED: <Badge tone="neutral">{t('Đã chặn từ trước', 'Already blocked')}</Badge>,
      FAILED: <Badge tone="danger">{t('Chặn thất bại', 'Failed')}</Badge>,
    })[s];
  const blocks = result?.blocks;
  const allGood = result && result.skipped === 0 && result.failed === 0 && (!blocks || blocks.failed === 0);

  return (
    <Modal
      width="max-w-2xl"
      title={allGood ? t('Đã xóa xong', 'Done') : t('Hoàn tất một phần', 'Partially completed')}
      description={t(
        `Đã xóa ${result.deleted} · Bỏ qua ${result.skipped} · Thất bại ${result.failed}`,
        `Deleted ${result.deleted} · Skipped ${result.skipped} · Failed ${result.failed}`
      )}
      onClose={onClose}
      footer={
        <button type="button" className={ui.btnPrimary} onClick={onClose}>
          {t('Đóng', 'Close')}
        </button>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <ul className="space-y-1.5">
          {result.results.map((r) => (
            <li key={r.storeId} className="flex flex-wrap items-center gap-2 text-[13px]">
              {r.status === 'DELETED' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400" aria-hidden="true" />
              )}
              <span className="font-medium text-slate-900">{r.name || `#${r.storeId}`}</span>
              {statusBadge(r.status)}
              {r.reason && <span className="text-slate-600">{r.reason}</span>}
            </li>
          ))}
        </ul>
        {blocks && (
          <section className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-[13px] font-semibold text-slate-900">
                {t(
                  `Chặn IP/thiết bị: ${blocks.blocked} đã chặn · ${blocks.alreadyBlocked} đã chặn từ trước · ${blocks.failed} thất bại`,
                  `Blocking: ${blocks.blocked} blocked · ${blocks.alreadyBlocked} already blocked · ${blocks.failed} failed`
                )}
              </h4>
              {blocks.failed > 0 && (
                <button type="button" className={`${ui.btnSecondary} h-8`} onClick={retryFailedBlocks} disabled={retrying}>
                  {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />}
                  {t('Thử chặn lại', 'Retry blocking')}
                </button>
              )}
            </div>
            <ul className="space-y-1.5">
              {blocks.results.map((b) => (
                <li key={`${b.kind}-${b.value}`} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-slate-600">{t(KIND_LABEL[b.kind][0], KIND_LABEL[b.kind][1])}:</span>
                  <Code value={b.value} n={b.kind === 'IP' ? 40 : 14} />
                  {blockBadge(b.status)}
                  {b.status === 'FAILED' && b.reason && <span className="text-red-700">{b.reason}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.blocks === null && blockCreators && result.deleted > 0 && (
          <p className="text-[12px] text-slate-500">{t('Không có IP/thiết bị nào được ghi nhận cho các cửa hàng đã xóa.', 'No IP/device was recorded for the deleted stores.')}</p>
        )}
      </div>
    </Modal>
  );
}

export default PurgeStoresDialog;
