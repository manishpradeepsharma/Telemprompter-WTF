import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';

export default function MobileQrConnect(): preact.JSX.Element {
  const [open, setOpen] = useState(false);
  const [httpUrl, setHttpUrl] = useState('http://192.168.1.5:4321');
  const [httpsUrl, setHttpsUrl] = useState('https://192.168.1.5:4323');
  const [selectedProtocol, setSelectedProtocol] = useState<'https' | 'http'>('https');
  const [activeUrl, setActiveUrl] = useState('https://192.168.1.5:4323');
  const [hasHttps, setHasHttps] = useState(true);
  const [qrSvg, setQrSvg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchLan = async () => {
      try {
        const res = await fetch('/api/lan-info');
        if (res.ok) {
          const data = await res.json();
          if (data.lanIp) {
            const hUrl = data.httpUrl || `http://${data.lanIp}:4321`;
            const sUrl = data.httpsUrl || `https://${data.lanIp}:4323`;
            setHttpUrl(hUrl);
            setHttpsUrl(sUrl);
            setHasHttps(Boolean(data.hasHttps));

            const initial = data.hasHttps ? sUrl : hUrl;
            setSelectedProtocol(data.hasHttps ? 'https' : 'http');
            setActiveUrl(initial);
            generateQr(initial);
            return;
          }
        }
      } catch {
        // Fallback
      }

      const host = window.location.hostname;
      const baseHost = host !== 'localhost' && host !== '127.0.0.1' ? host : '192.168.1.5';
      const hUrl = `http://${baseHost}:4321`;
      const sUrl = `https://${baseHost}:4323`;
      setHttpUrl(hUrl);
      setHttpsUrl(sUrl);
      setSelectedProtocol('https');
      setActiveUrl(sUrl);
      generateQr(sUrl);
    };

    fetchLan();
  }, []);

  const generateQr = async (url: string) => {
    try {
      const svg = await QRCode.toString(url, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#171713',
          light: '#ffffff',
        },
      });
      setQrSvg(svg);
    } catch (err) {
      console.error('Failed to generate QR code SVG:', err);
    }
  };

  const handleSelectProtocol = (proto: 'https' | 'http') => {
    setSelectedProtocol(proto);
    const targetUrl = proto === 'https' ? httpsUrl : httpUrl;
    setActiveUrl(targetUrl);
    generateQr(targetUrl);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <button
        type="button"
        class="mobile-qr-trigger-btn"
        onClick={() => setOpen(true)}
        aria-label="Connect mobile via QR code"
      >
        <span class="mobile-qr-icon">📱</span>
        <span class="mobile-qr-text">Open on Mobile</span>
        <span class="mobile-qr-badge">LAN QR</span>
      </button>

      {open && (
        <div class="organizer-modal" onClick={() => setOpen(false)}>
          <div
            class="organizer-modal__card mobile-qr-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-qr-title"
          >
            <div class="organizer-modal__header">
              <div>
                <span class="organizer-badge-folder">📡 Wi-Fi Local Area Network</span>
                <h2 id="mobile-qr-title">Open on Mobile Device</h2>
              </div>
              <button
                type="button"
                class="organizer-modal__close"
                onClick={() => setOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div class="mobile-qr-content">
              {hasHttps && (
                <div class="mobile-qr-proto-tabs" role="tablist" aria-label="Connection Protocol">
                  <button
                    type="button"
                    class={`mobile-qr-proto-tab ${selectedProtocol === 'https' ? 'mobile-qr-proto-tab--active' : ''}`}
                    onClick={() => handleSelectProtocol('https')}
                  >
                    🔒 HTTPS (Camera Enabled)
                  </button>
                  <button
                    type="button"
                    class={`mobile-qr-proto-tab ${selectedProtocol === 'http' ? 'mobile-qr-proto-tab--active' : ''}`}
                    onClick={() => handleSelectProtocol('http')}
                  >
                    🌐 HTTP (:4321)
                  </button>
                </div>
              )}

              <p class="mobile-qr-subtitle">
                {selectedProtocol === 'https'
                  ? 'Scan to open with Camera Permission support enabled for iPhone, iPad, and Android:'
                  : 'Scan to connect over standard HTTP on your local network:'}
              </p>

              <div class="mobile-qr-display-card">
                {qrSvg ? (
                  <div class="mobile-qr-svg-wrap" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                ) : (
                  <div class="mobile-qr-loading">Generating QR code…</div>
                )}
                <div class="mobile-qr-url-pill" onClick={copyUrl} title="Click to copy URL">
                  <code>{activeUrl}</code>
                  <span class="mobile-qr-copy-tag">{copied ? '✓ Copied!' : 'Copy'}</span>
                </div>
              </div>

              {selectedProtocol === 'https' && (
                <div class="mobile-qr-notice">
                  <span class="mobile-qr-notice__icon">💡</span>
                  <div class="mobile-qr-notice__text">
                    <strong>Local SSL First Visit:</strong> If your mobile browser displays a
                    certificate warning, tap <em>"Show Details"</em> → <em>"Visit this website"</em>{' '}
                    to enable camera permissions.
                  </div>
                </div>
              )}

              <div class="mobile-qr-instructions">
                <div class="mobile-qr-step">
                  <span class="mobile-qr-step-num">1</span>
                  <span>Connect your phone to the same local Wi-Fi network.</span>
                </div>
                <div class="mobile-qr-step">
                  <span class="mobile-qr-step-num">2</span>
                  <span>Open your phone camera and scan the QR code above.</span>
                </div>
                <div class="mobile-qr-step">
                  <span class="mobile-qr-step-num">3</span>
                  <span>Tap "Allow" when the browser asks for Camera Permission!</span>
                </div>
              </div>
            </div>

            <div class="organizer-modal__actions">
              <button type="button" class="button button--secondary" onClick={() => setOpen(false)}>
                Close
              </button>
              <button type="button" class="button button--primary" onClick={copyUrl}>
                {copied ? '✓ Link Copied!' : '📋 Copy Mobile Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
