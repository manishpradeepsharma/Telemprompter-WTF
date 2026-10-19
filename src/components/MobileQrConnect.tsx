import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';

function isDockerBridge(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    const p0 = parts[0] ?? -1;
    const p1 = parts[1] ?? -1;
    const p2 = parts[2] ?? -1;
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    if (p0 === 10 && p1 === 0 && p2 === 2) return true;
    if (p0 === 192 && p1 === 168 && p2 === 65) return true;
  }
  return false;
}

export default function MobileQrConnect(): preact.JSX.Element {
  const [httpUrl, setHttpUrl] = useState('http://192.168.1.5:4321');
  const [httpsUrl, setHttpsUrl] = useState('https://192.168.1.5:4323');
  const [selectedProtocol, setSelectedProtocol] = useState<'https' | 'http'>('https');
  const [activeUrl, setActiveUrl] = useState('https://192.168.1.5:4323');
  const [hasHttps, setHasHttps] = useState(true);
  const [qrSvg, setQrSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDockerWarning, setIsDockerWarning] = useState(false);
  const [detectedDockerIp, setDetectedDockerIp] = useState('');
  const [customIp, setCustomIp] = useState('');
  const [hasCustomIp, setHasCustomIp] = useState(false);

  const updateUrlsWithIp = (ip: string, httpsAvailable = hasHttps) => {
    const cleanIp = ip.trim();
    const hUrl = `http://${cleanIp}:4321`;
    const sUrl = `https://${cleanIp}:4323`;
    setHttpUrl(hUrl);
    setHttpsUrl(sUrl);
    const target = httpsAvailable && selectedProtocol === 'https' ? sUrl : hUrl;
    setActiveUrl(target);
    generateQr(target);
  };

  useEffect(() => {
    const savedIp = typeof window !== 'undefined' ? localStorage.getItem('tp_lan_ip_override') : null;
    if (savedIp) {
      setCustomIp(savedIp);
      setHasCustomIp(true);
    }

    const fetchLan = async () => {
      let finalIp = savedIp || '';
      let isDocker = false;
      let httpsSupported = true;

      try {
        const res = await fetch('/api/lan-info');
        if (res.ok) {
          const data = await res.json();
          httpsSupported = Boolean(data.hasHttps);
          setHasHttps(httpsSupported);

          const isInternalDocker = Boolean(data.isDockerIp) || isDockerBridge(data.lanIp);
          if (isInternalDocker) {
            isDocker = true;
            setDetectedDockerIp(data.lanIp || '172.18.0.2');
          }

          if (!finalIp) {
            // Check if window.location.hostname is a real LAN IP
            const host = window.location.hostname;
            const isHostLanIp =
              host !== 'localhost' &&
              host !== '127.0.0.1' &&
              !isDockerBridge(host) &&
              /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

            if (isHostLanIp) {
              finalIp = host;
            } else if (!isInternalDocker && data.lanIp) {
              finalIp = data.lanIp;
            } else {
              finalIp = data.lanIp || '192.168.1.5';
            }
          }
        }
      } catch {
        const host = window.location.hostname;
        finalIp =
          savedIp || (host !== 'localhost' && host !== '127.0.0.1' && !isDockerBridge(host) ? host : '192.168.1.5');
      }

      setIsDockerWarning(isDocker && !savedIp && isDockerBridge(finalIp));
      updateUrlsWithIp(finalIp, httpsSupported);
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

  const applyCustomIp = () => {
    if (!customIp.trim()) return;
    localStorage.setItem('tp_lan_ip_override', customIp.trim());
    setHasCustomIp(true);
    setIsDockerWarning(false);
    updateUrlsWithIp(customIp.trim());
  };

  const resetCustomIp = () => {
    localStorage.removeItem('tp_lan_ip_override');
    setCustomIp('');
    setHasCustomIp(false);
    // Reload LAN detection
    window.location.reload();
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

      {isDockerWarning && (
        <div class="mobile-qr-notice mobile-qr-notice--warning">
          <span class="mobile-qr-notice__icon">⚠️</span>
          <div class="mobile-qr-notice__text">
            <strong>Docker internal IP ({detectedDockerIp}) detected:</strong> Mobile devices cannot connect to
            Docker's internal bridge network. Run <code>ipconfig</code> in Windows PowerShell / Command Prompt, find your
            Wi-Fi IPv4 address (e.g. <code>192.168.1.X</code>), and set it below.
          </div>
        </div>
      )}

      <div class="mobile-qr-ip-config">
        <div class="mobile-qr-ip-config__row">
          <span class="mobile-qr-ip-label">Host IP:</span>
          <input
            type="text"
            class="mobile-qr-ip-input"
            value={customIp}
            placeholder="e.g. 192.168.1.50"
            onInput={(e) => setCustomIp((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCustomIp();
            }}
          />
          <button type="button" class="mobile-qr-ip-btn" onClick={applyCustomIp}>
            Set IP
          </button>
          {hasCustomIp && (
            <button
              type="button"
              class="mobile-qr-ip-reset"
              onClick={resetCustomIp}
              title="Reset to auto-detected IP"
            >
              Reset
            </button>
          )}
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
          <span>Connect your iPhone to the same Wi-Fi network as your PC.</span>
        </div>
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">2</span>
          <span>Scan the QR code with your iPhone Camera app.</span>
        </div>
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">3</span>
          <span>
            If iOS Safari warns <strong>"This Connection Is Not Private"</strong>, tap <strong>Show Details</strong> →{' '}
            <strong>visit this website</strong>.
          </span>
        </div>
        <div class="mobile-qr-step">
          <span class="mobile-qr-step-num">4</span>
          <span>Tap <strong>Allow</strong> when prompted for Camera permissions!</span>
        </div>
      </div>
    </div>
  );
}
