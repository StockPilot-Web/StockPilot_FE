import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoadingPromise = null;

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`);
    if (existing) {
      const check = setInterval(() => {
        if (window.turnstile) {
          clearInterval(check);
          resolve(window.turnstile);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (window.turnstile) {
          clearInterval(check);
          resolve(window.turnstile);
        }
      }, 50);
    };
    script.onerror = (err) => {
      scriptLoadingPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export const TurnstileWidget = forwardRef(function TurnstileWidget(
  {
    siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY,
    onVerify,
    onExpire,
    onError,
    theme = 'light',
    size = 'normal',
    action = 'register',
    className = '',
  },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          setIsVerifying(true);
        } catch (e) {
          console.warn('[Turnstile] Reset failed:', e);
        }
      }
    },
    remove: () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {
          console.warn('[Turnstile] Remove failed:', e);
        }
      }
    },
  }));

  useEffect(() => {
    if (!siteKey) {
      console.warn('[Turnstile] VITE_TURNSTILE_SITE_KEY chưa được cấu hình. Bypass cho môi trường dev.');
      onVerify?.('dev-mock-turnstile-token');
      setIsVerifying(false);
      return;
    }

    let isMounted = true;

    loadTurnstileScript()
      .then((turnstile) => {
        if (!isMounted || !containerRef.current || !turnstile) return;

        // Clean up previous widget if exists
        if (widgetIdRef.current !== null) {
          try {
            turnstile.remove(widgetIdRef.current);
          } catch (_) {}
          widgetIdRef.current = null;
        }

        try {
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            size,
            action,
            callback: (token) => {
              if (!isMounted) return;
              setIsVerifying(false);
              setLoadError(false);
              onVerify?.(token);
            },
            'error-callback': (code) => {
              if (!isMounted) return;
              setIsVerifying(false);
              setLoadError(true);
              onError?.(code);
            },
            'expired-callback': () => {
              if (!isMounted) return;
              setIsVerifying(true);
              onExpire?.();
            },
          });
        } catch (renderErr) {
          console.error('[Turnstile] Render error:', renderErr);
          if (isMounted) setLoadError(true);
        }
      })
      .catch((err) => {
        console.error('[Turnstile] Failed to load Turnstile script:', err);
        if (isMounted) {
          setLoadError(true);
          setIsVerifying(false);
        }
      });

    return () => {
      isMounted = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size, action]);

  if (!siteKey) {
    return (
      <div className={`p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2 ${className}`}>
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Chế độ kiểm thử (Dev Mode): Đã tự động vượt qua CAPTCHA.</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-[66px] transition-all ${className}`}>
      <div ref={containerRef} className="flex justify-center" />

      {loadError && (
        <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Không thể tải mã bảo mật CAPTCHA.</span>
          <button
            type="button"
            onClick={() => {
              setLoadError(false);
              setIsVerifying(true);
              if (widgetIdRef.current !== null && window.turnstile) {
                window.turnstile.reset(widgetIdRef.current);
              }
            }}
            className="ml-auto underline font-semibold flex items-center gap-1 hover:text-red-700 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Thử lại
          </button>
        </div>
      )}
    </div>
  );
});
