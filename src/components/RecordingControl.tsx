import { useEffect, useRef, useState } from 'preact/hooks';
import { analytics, durationBucket } from '../domain/analytics';
import { detectBrowserCapabilities } from '../domain/capabilities';
import { api } from '../domain/api';

type RecordingMode = 'screen' | 'camera';

const supportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  return (
    [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  );
};

const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

interface RecordingControlProps {
  cameraStream?: MediaStream | null;
  onCameraStreamChange?: (stream: MediaStream | null) => void;
  onRecordingStart?: () => void;
}

export default function RecordingControl({
  cameraStream,
  onCameraStreamChange,
  onRecordingStart,
}: RecordingControlProps = {}): preact.JSX.Element | null {
  const capabilities = useRef(detectBrowserCapabilities()).current;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RecordingMode>(capabilities.camera ? 'camera' : 'screen');
  const [includeMic, setIncludeMic] = useState(true);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownCancelRef = useRef<((reason?: unknown) => void) | null>(null);
  const secondsRef = useRef(0);
  const captureFailedRef = useRef(false);

  const available =
    capabilities.mediaRecorder && (capabilities.displayCapture || capabilities.camera);

  useEffect(() => {
    if (open) doneRef.current?.focus();
  }, [open]);

  useEffect(
    () => () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      cleanupCapture();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (countdownCancelRef.current) {
      countdownCancelRef.current('cancelled');
      countdownCancelRef.current = null;
    }
    setCountdown(null);
    cleanupCapture();
  };

  useEffect(() => {
    if (countdown === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelCountdown();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [countdown]);

  if (!available) return null;

  const cleanupCapture = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamsRef.current.forEach((stream) => {
      if (stream !== cameraStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });
    streamsRef.current = [];
  };

  const finish = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else cleanupCapture();
  };

  const close = () => {
    if (recording) finish();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleDialogKey = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const playTickSound = (frequency = 600) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context may be blocked by autoplay policies
    }
  };

  const start = async () => {
    setMessage('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    const selectedMimeType = supportedMimeType();
    if (!selectedMimeType) {
      setMessage('This browser does not expose a supported recording format.');
      analytics.track('recording_start_failed', { reason: 'unavailable' });
      return;
    }
    try {
      let primary: MediaStream;
      const extraStreams: MediaStream[] = [];
      const outputTracks: MediaStreamTrack[] = [];

      if (mode === 'camera') {
        const hasLiveCamera =
          cameraStream &&
          cameraStream.active &&
          cameraStream.getVideoTracks().some((track) => track.readyState === 'live');

        if (hasLiveCamera) {
          primary = cameraStream;
        } else {
          primary = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
          onCameraStreamChange?.(primary);
        }

        outputTracks.push(...primary.getVideoTracks());

        if (includeMic) {
          const microphone = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          extraStreams.push(microphone);
          outputTracks.push(...microphone.getAudioTracks());
        }
      } else {
        primary = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        outputTracks.push(...primary.getTracks());

        if (includeMic) {
          const microphone = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          extraStreams.push(microphone);
          outputTracks.push(...microphone.getAudioTracks());
        }
      }

      streamsRef.current = [primary, ...extraStreams];
      const output = new MediaStream(outputTracks);

      setOpen(false);

      // Visual and auditory 3, 2, 1 Countdown
      for (const step of [3, 2, 1]) {
        setCountdown(step);
        playTickSound(step === 1 ? 880 : 587.33);
        await new Promise<void>((resolve, reject) => {
          countdownTimerRef.current = setTimeout(resolve, 1000);
          countdownCancelRef.current = reject;
        });
      }
      setCountdown(null);

      const recorder = new MediaRecorder(output, { mimeType: selectedMimeType });
      chunksRef.current = [];
      captureFailedRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        captureFailedRef.current = true;
        setMessage('Recording stopped because the browser reported a capture error.');
        setRecording(false);
        cleanupCapture();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedMimeType });
        chunksRef.current = [];
        if (blob.size) {
          recordedBlobRef.current = blob;
          setPreviewUrl(URL.createObjectURL(blob));
          setUploadSuccess(false);
          setUploadError('');
          setOpen(true);
        }
        setRecording(false);
        cleanupCapture();
        if (!captureFailedRef.current) {
          analytics.track('finished_recording', {
            recording_type: mode,
            duration_bucket: durationBucket(secondsRef.current),
          });
        }
      };
      primary.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => finish(), { once: true });
      });
      recorderRef.current = recorder;
      recorder.start(1000);
      setMimeType(selectedMimeType);
      setSeconds(0);
      secondsRef.current = 0;
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
      onRecordingStart?.();
      analytics.track('started_recording', {
        recording_type: mode,
        microphone_included: includeMic,
      });
    } catch (error) {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      cleanupCapture();
      if (error === 'cancelled') return;
      const cancelled = error instanceof DOMException && error.name === 'NotAllowedError';
      analytics.track('recording_start_failed', {
        reason: cancelled ? 'permission_blocked' : 'unavailable',
      });
      setMessage(
        cancelled
          ? 'Recording was cancelled or permission was blocked.'
          : 'Recording could not start on this device.',
      );
    }
  };

  const download = () => {
    if (!previewUrl) return;
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `teleprompter-recording-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
    analytics.track('saved_recording', { recording_type: mode });
  };

  const uploadToServer = async () => {
    if (!recordedBlobRef.current) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    const user = await api.getAuth();
    if (!user) {
      setUploading(false);
      setUploadError('Please log in first to upload your recording to the server.');
      return;
    }

    const scriptTitle = localStorage.getItem('teleprompter_active_title') || 'Teleprompter Session';
    const res = await api.uploadRecording({
      videoBlob: recordedBlobRef.current,
      durationSeconds: secondsRef.current,
      scriptTitle,
    });
    setUploading(false);

    if (res.error) {
      setUploadError(res.error);
    } else {
      setUploadSuccess(true);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        class={`control-button ${recording ? 'control-button--recording' : ''}`}
        disabled={countdown !== null}
        onClick={() => {
          if (recording) {
            finish();
          } else {
            analytics.track('opened_recording_panel');
            setOpen(true);
          }
        }}
        aria-label={
          countdown !== null ? 'Starting recording...' : recording ? 'Stop and preview' : 'Record'
        }
        title={
          countdown !== null
            ? 'Starting recording...'
            : recording
              ? 'Stop recording and preview'
              : 'Record'
        }
      >
        {countdown !== null ? (
          <>
            <span class="recording-pulse-dot" aria-hidden="true" />
            <span>Starting ({countdown})...</span>
          </>
        ) : recording ? (
          <>
            <span class="recording-pulse-dot" aria-hidden="true" />
            <span>Stop and preview</span>
            <time>{formatTimer(seconds)}</time>
          </>
        ) : (
          'Record'
        )}
      </button>
      {recording && (
        <button class="recording-stop" onClick={finish} aria-label="Stop recording">
          <span aria-hidden="true" /> Stop recording <time>{formatTimer(seconds)}</time>
        </button>
      )}
      {open && (
        <div class="presenter__scrim" onClick={close} onKeyDown={handleDialogKey}>
          <section
            ref={panelRef}
            class="record-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Browser-local capture</p>
                <h2 id="record-title">Record</h2>
              </div>
              <button ref={doneRef} class="control-button" onClick={close}>
                Done
              </button>
            </div>
            {!recording && !previewUrl && (
              <>
                <fieldset class="record-modes">
                  <legend>What do you want to record?</legend>
                  {capabilities.displayCapture && (
                    <label>
                      <input
                        type="radio"
                        name="record-mode"
                        checked={mode === 'screen'}
                        onChange={() => setMode('screen')}
                      />
                      <span>
                        <b>Screen</b>
                        <small>A tab, window, or display</small>
                      </span>
                    </label>
                  )}
                  {capabilities.camera && (
                    <label>
                      <input
                        type="radio"
                        name="record-mode"
                        checked={mode === 'camera'}
                        onChange={() => setMode('camera')}
                      />
                      <span>
                        <b>Camera</b>
                        <small>Your local webcam feed</small>
                      </span>
                    </label>
                  )}
                </fieldset>
                <label class="toggle-field record-mic">
                  <span>
                    <b>Include microphone</b>
                    <small>Requested only when recording starts</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeMic}
                    onChange={(event) => setIncludeMic(event.currentTarget.checked)}
                  />
                </label>
                <button
                  class="button button--primary button--start-record"
                  onClick={() => void start()}
                >
                  Start recording
                </button>
              </>
            )}
            {recording && (
              <div class="recording-live" role="status">
                <span aria-hidden="true" />
                <strong>Recording {formatTimer(seconds)}</strong>
                <p>The browser is capturing your {mode}. Stop is always available above.</p>
                <button class="button button--primary" onClick={finish}>
                  Stop and preview
                </button>
              </div>
            )}
            {previewUrl && !recording && (
              <div class="record-preview">
                <video controls src={previewUrl} />
                <div class="record-preview-actions">
                  <button class="button button--primary" onClick={download}>
                    Save recording
                  </button>
                  <button
                    class="button button--upload"
                    onClick={uploadToServer}
                    disabled={uploading || uploadSuccess}
                  >
                    {uploading
                      ? 'Uploading to Server…'
                      : uploadSuccess
                        ? '✓ Uploaded to Server'
                        : '☁ Upload to Server'}
                  </button>
                  <button
                    class="button button--quiet"
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl('');
                      recordedBlobRef.current = null;
                      setUploadSuccess(false);
                      setUploadError('');
                      analytics.track('discarded_recording', { recording_type: mode });
                    }}
                  >
                    Discard
                  </button>
                </div>
                {uploadError && (
                  <p class="record-upload-msg record-upload-msg--error">
                    {uploadError}{' '}
                    {uploadError.includes('log in') && (
                      <a href="/login" target="_blank" rel="noopener noreferrer">
                        Log in here
                      </a>
                    )}
                  </p>
                )}
                {uploadSuccess && (
                  <p class="record-upload-msg record-upload-msg--success">
                    Recording saved to server filestore!{' '}
                    <a href="/recordings" target="_blank" rel="noopener noreferrer">
                      View in My Recordings
                    </a>
                  </p>
                )}
                <p>{mimeType.includes('mp4') ? 'MP4' : 'WebM'} video format.</p>
              </div>
            )}
            <p class="record-privacy">Recording stays on this device. Nothing is uploaded.</p>
            {message && (
              <p class="voice-message" role="status">
                {message}
              </p>
            )}
          </section>
        </div>
      )}
      {countdown !== null && (
        <div
          class="recording-countdown-overlay"
          aria-live="assertive"
          role="alert"
          onClick={cancelCountdown}
        >
          <div class="recording-countdown-card" onClick={(event) => event.stopPropagation()}>
            <span class="recording-countdown-number" key={countdown}>
              {countdown}
            </span>
            <span class="recording-countdown-label">Get Ready</span>
            <button type="button" class="recording-countdown-cancel" onClick={cancelCountdown}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
