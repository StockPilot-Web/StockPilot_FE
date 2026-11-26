import React, { useState } from 'react';
import { Check, ChevronDown, ExternalLink, HelpCircle, ListChecks } from 'lucide-react';

const PAYOS_DASHBOARD_URL = 'https://my.payos.vn';

function StepItem({ index, done, onToggle, title, children, isEn }) {
  const stateLabel = done ? (isEn ? 'done' : 'đã xong') : (isEn ? 'not done' : 'chưa xong');
  return (
    <li className="flex gap-3">
      {onToggle ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${isEn ? 'Step' : 'Bước'} ${index}: ${title} — ${stateLabel}`}
          onClick={onToggle}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'}`}
        >
          {done ? <Check className="size-4" aria-hidden /> : index}
        </button>
      ) : (
        <span
          aria-label={`${isEn ? 'Step' : 'Bước'} ${index} — ${stateLabel}`}
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-inset ${done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-600 ring-slate-300'}`}
        >
          {done ? <Check className="size-4" aria-hidden /> : index}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className={`text-sm font-medium ${done ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>{title}</p>
        <div className="text-xs leading-5 text-slate-500">{children}</div>
      </div>
    </li>
  );
}

function FaqItem({ question, children }) {
  return (
    <details className="group border-b border-slate-100 last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-3 text-xs leading-5 text-slate-600">{children}</div>
    </details>
  );
}

export function PayOSSideGuide({ config, isEn }) {
  // Bước 1–2 chủ shop tự đánh dấu (không lưu); bước 3 suy ra từ cấu hình thật trên máy chủ.
  const [manualDone, setManualDone] = useState({ 1: false, 2: false });
  const keysSaved = config.configured && !config.needsReentry;
  const toggle = (step) => () => setManualDone(prev => ({ ...prev, [step]: !prev[step] }));
  const doneCount = Number(manualDone[1]) + Number(manualDone[2]) + Number(keysSaved);

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-4">
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]" aria-labelledby="payos-checklist-title">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 id="payos-checklist-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ListChecks className="size-4 text-slate-500" aria-hidden /> {isEn ? 'Setup checklist' : 'Các bước thiết lập'}
          </h3>
          <span className="text-xs font-medium tabular-nums text-slate-500">{doneCount}/3</span>
        </div>
        <ol className="space-y-4">
          <StepItem index={1} done={manualDone[1]} onToggle={toggle(1)} isEn={isEn}
            title={isEn ? 'Open the PayOS dashboard' : 'Mở cổng thanh toán PayOS'}>
            <p>{isEn ? 'Sign in with your merchant account.' : 'Đăng nhập bằng tài khoản chủ cửa hàng.'}</p>
            <a
              href={PAYOS_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {isEn ? 'Open PayOS Dashboard' : 'Mở PayOS Dashboard'} <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">{isEn ? '(opens in a new tab)' : '(mở tab mới)'}</span>
            </a>
          </StepItem>
          <StepItem index={2} done={manualDone[2]} onToggle={toggle(2)} isEn={isEn}
            title={isEn ? 'Paste the Webhook URL' : 'Dán Webhook URL vào Kênh thanh toán'}>
            <p>{isEn ? 'Payment Channels → your channel → Webhook URL, then save in PayOS.' : 'Kênh thanh toán → kênh của bạn → Webhook URL, rồi bấm lưu trên PayOS.'}</p>
          </StepItem>
          <StepItem index={3} done={keysSaved} isEn={isEn}
            title={isEn ? 'Finish the connection in StockPilot' : 'Hoàn tất kết nối trên StockPilot'}>
            <p>{keysSaved
              ? (isEn ? 'Saved. Use "Test connection" to verify.' : 'Đã lưu. Bấm "Kiểm tra kết nối" để xác minh.')
              : (isEn ? 'Enter the connection details below, then save and test.' : 'Nhập thông tin kết nối bên dưới, sau đó lưu và kiểm tra.')}</p>
          </StepItem>
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]" aria-labelledby="payos-faq-title">
        <h3 id="payos-faq-title" className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900">
          <HelpCircle className="size-4 text-slate-500" aria-hidden /> {isEn ? 'Quick help' : 'Trợ giúp nhanh'}
        </h3>
        <FaqItem question={isEn ? 'Customer paid but the order is not updated?' : 'Khách đã thanh toán nhưng đơn chưa cập nhật?'}>
          {isEn
            ? 'First, check the connection status above and run “Test connection”. If the order is still pending, contact support with the order code and payment time.'
            : 'Trước tiên, hãy kiểm tra trạng thái kết nối và bấm “Kiểm tra kết nối”. Nếu đơn vẫn chờ, hãy liên hệ hỗ trợ kèm mã đơn và thời điểm thanh toán.'}
        </FaqItem>
        <FaqItem question={isEn ? 'How do I turn VietQR on or off at the POS?' : 'Bật hoặc tắt VietQR tại quầy POS thế nào?'}>
          {isEn
            ? 'Use the VietQR switch at the top of this page. You can pause VietQR without deleting the saved connection.'
            : 'Dùng công tắc VietQR ở đầu trang. Bạn có thể tạm tắt VietQR mà không xóa thông tin kết nối đã lưu.'}
        </FaqItem>
        <FaqItem question={isEn ? 'What should I do if setup is still incomplete?' : 'Nếu chưa thiết lập xong thì phải làm gì?'}>
          {isEn
            ? 'Complete the three setup steps, save the connection details, and run “Test connection”. The POS will show VietQR after the connection is active.'
            : 'Hoàn tất ba bước thiết lập, lưu thông tin kết nối và bấm “Kiểm tra kết nối”. POS sẽ hiển thị VietQR sau khi kết nối hoạt động.'}
        </FaqItem>
      </section>
    </aside>
  );
}
