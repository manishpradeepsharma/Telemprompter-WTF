import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';

export default function MobileQrConnect(): preact.JSX.Element {
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
    <div class="mobile-qr-inline-card">
      <div class="mobile-qr-inline-header">
        <div>
          <div class="mobile-qr-inline-badge-row">
            <span class="mobile-qr-badge">📡 Local Area Network</span>
            {selectedProtocol === 'https' && (
              <span class="mobile-qr-camera-badge">📷 Camera Enabled</span>
            )}
          </div>
          <h2 class="mobile-qr-inline-title">Open on Mobile / Tablet</h2>
        </div>
      </div>

      {hasHttps && (
        <div class="mobile-qr-proto-tabs" role="tablist" aria-label="Connection Protocol">
          <button
            type="button"
            class={`mobile-qr-proto-tab ${selectedProtocol === 'https' ? 'mobile-qr-proto-tab--active' : ''}`}
            onClick={() => handleSelectProtocol('https')}
          >
            🔒 HTTPS (Camera Ready)
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

      <div class="mobile-qr-instructions">
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">1</span>
          <span>Connect your phone or tablet to the same Wi-Fi.</span>
        </div>
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">2</span>
          <span>Scan the QR code with your camera app.</span>
        </div>
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">3</span>
          <span>Tap "Allow" for camera permission to record!</span>
        </div>
      </div>
    </div>
  );
}
