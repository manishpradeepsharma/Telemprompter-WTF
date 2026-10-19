import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { analytics, type EntryContext, type SettingName } from '../domain/analytics';
import { durationSeconds, formatDuration, requiredWpm } from '../domain/calculations';
import { detectBrowserCapabilities } from '../domain/capabilities';
import {
  LOCAL_STATE_KEY,
  clearLocalState,
  defaultState,
  embedInitialState,
  embedStorageKey,
  loadLocalState,
  saveLocalState,
} from '../domain/localState';
import { SETTING_LIMITS } from '../domain/settings';
import { compileScriptGuide } from '../domain/scriptGuide';
import { primeBrowserSpeechInUserGesture } from '../domain/browserSpeech';
import type { PresenterPreferences, PrivacyConsent } from '../domain/types';
import Presenter, { requestCameraStream } from './Presenter';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface TeleprompterAppProps {
  variant?: 'full' | 'compact';
  embedId?: string;
  initialScript?: string;
  preset?: Partial<PresenterPreferences> | undefined;
}

export default function TeleprompterApp({
  variant = 'full',
  embedId,
  initialScript,
  preset,
}: TeleprompterAppProps): preact.JSX.Element {
  const embedded = Boolean(embedId);
  const storageKey = embedded ? embedStorageKey(embedId as string) : LOCAL_STATE_KEY;
  const initial = useMemo(
    () => (embedded ? embedInitialState(initialScript ?? '', preset) : defaultState()),
    // The initial workspace state is derived once per mount; later edits come from the user.
    [],
  );
  const [script, setScript] = useState(initial.script);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsent>(initial.privacyConsent);
  const [presenting, setPresenting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Saved only on this device');
  const [notice, setNotice] = useState('');
  const [preloadedCameraStream, setPreloadedCameraStream] = useState<MediaStream | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryContextRef = useRef<EntryContext>('new_script');
  const guide = useMemo(
    () => compileScriptGuide(script, preferences.speakingWpm),
    [script, preferences.speakingWpm],
  );
  const words = guide.spokenWordCount;
  const duration = useMemo(
    () => durationSeconds(words, preferences.speakingWpm),
    [words, preferences.speakingWpm],
  );

  useEffect(() => {
    const saved = loadLocalState(localStorage, storageKey);
    const hasSaved = saved.savedAt > 0;
    let restoredPreferences = saved.preferences;
    // One-shot experience refresh: older installs defaulted to Manual. Promote them to
    // Smart Pace once so the product asks to listen by default. Precision stays put.
    // Embedded practice workspaces keep their authored manual default instead.
    const experienceKey = 'teleprompter-wtf.experience-v2-smart';
    if (!embedded) {
      try {
        if (!localStorage.getItem(experienceKey)) {
          if (restoredPreferences.voiceMode === 'manual') {
            restoredPreferences = { ...restoredPreferences, voiceMode: 'smart' };
          }
          localStorage.setItem(experienceKey, '1');
        }
      } catch {
        // Storage can be unavailable; the in-memory default still prefers Smart Pace.
      }
    }
    const imported = localStorage.getItem('teleprompter_imported_script');
    let activeScript = saved.script;
    if (imported) {
      setScript(imported);
      activeScript = imported;
      localStorage.removeItem('teleprompter_imported_script');
    } else if (hasSaved) {
      setScript(saved.script);
      setPreferences(restoredPreferences);
    } else if (!embedded) {
      setScript(saved.script);
      setPreferences(restoredPreferences);
    }
    setPrivacyConsent(saved.privacyConsent);
    setSaveStatus(hasSaved ? 'Restored from this device' : 'Saved only on this device');

    const autoPresent =
      localStorage.getItem('teleprompter_autoplay') === '1' ||
      new URLSearchParams(window.location.search).get('present') === '1';

    if (autoPresent) {
      localStorage.removeItem('teleprompter_autoplay');
      if (window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('present');
        window.history.replaceState({}, '', url.pathname);
      }
      const fullText = imported || activeScript || '';
      const firstLine = fullText.split('\n')[0] ?? '';
      const title = firstLine
        .replace(/^[#*\s-]+/, '')
        .trim()
        .slice(0, 60);
      localStorage.setItem('teleprompter_active_title', title || 'Teleprompter Session');
      localStorage.setItem('teleprompter_active_script_content', fullText);
      if (restoredPreferences.voiceMode === 'smart') primeBrowserSpeechInUserGesture();
      setPresenting(true);
    }
    // Derived once at app start: a non-empty restored script means this session continues
    // earlier work. It is a one-off enum, never a persistent identifier. An authored embed
    // sample is new work, not a restored session.
    entryContextRef.current = hasSaved && saved.script.trim() ? 'restored_script' : 'new_script';
    setHydrated(true);

    const onConsent = (event: Event) => {
      setPrivacyConsent((event as CustomEvent<PrivacyConsent>).detail);
    };
    const onCleared = () => {
      const clean = embedded ? embedInitialState(initialScript ?? '', preset) : defaultState();
      setScript(clean.script);
      setPreferences(clean.preferences);
      setPrivacyConsent(clean.privacyConsent);
      setSaveStatus('Local data cleared');
    };
    window.addEventListener('teleprompter:consent-change', onConsent);
    window.addEventListener('teleprompter:local-data-cleared', onCleared);
    return () => {
      window.removeEventListener('teleprompter:consent-change', onConsent);
      window.removeEventListener('teleprompter:local-data-cleared', onCleared);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus('Saving on this device…');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        saveLocalState({ script, preferences, privacyConsent }, localStorage, storageKey);
        setSaveStatus('Saved only on this device');
      } catch {
        setSaveStatus('Could not save. Browser storage may be unavailable.');
      }
    }, 350);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [script, preferences, privacyConsent, hydrated, storageKey]);

  const updatePreferences = (next: PresenterPreferences, setting?: SettingName) => {
    setPreferences(next);
    // Continuous slider drags call this without a setting; only discrete selections
    // (and slider commits) carry one, so changed_presenter_setting stays low cardinality.
    if (setting) analytics.track('changed_presenter_setting', { setting });
  };

  const clearScript = () => {
    if (
      script.trim() &&
      !window.confirm('Clear this script? This cannot be undone after autosave.')
    ) {
      return;
    }
    setScript('');
    setNotice('Script cleared.');
    analytics.track('cleared_script');
  };

  const clearEverything = () => {
    if (
      !window.confirm(
        embedded
          ? 'Delete the saved script and preferences for this practice workspace on this device?'
          : 'Delete your saved script and all teleprompter.wtf preferences on this device?',
      )
    ) {
      return;
    }
    clearLocalState(localStorage, storageKey);
    const clean = embedded ? embedInitialState(initialScript ?? '', preset) : defaultState();
    setScript(clean.script);
    setPreferences(clean.preferences);
    setPrivacyConsent(clean.privacyConsent);
    setNotice('Local script and preferences cleared.');
    setSaveStatus('Local data cleared');
    analytics.track('cleared_local_data');
    if (!embedded) {
      window.dispatchEvent(new CustomEvent('teleprompter:local-data-cleared'));
    }
  };

  const importText = async (file: File | undefined) => {
    if (!file) return;
    setNotice('');
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setNotice('Choose a plain-text .txt file.');
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice('That file is larger than 5 MB. Please use a smaller plain-text file.');
      return;
    }
    try {
      const text = (await file.text()).replace(/\r\n?/g, '\n');
      if (text.includes('\u0000')) throw new Error('Binary content');
      setScript(text);
      setNotice('Text file imported.');
      analytics.track('imported_plain_text_script', { source_type: 'txt' });
    } catch {
      setNotice('That file could not be read as plain text.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const share = async () => {
    const url = 'https://www.teleprompter.wtf';
    const capabilities = detectBrowserCapabilities();
    try {
      if (capabilities.webShare) {
        await navigator.share({
          title: 'teleprompter.wtf',
          text: 'A free, private online teleprompter.',
          url,
        });
        setNotice('Thanks for sharing.');
      } else if (capabilities.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice('Link copied to clipboard.');
      } else {
        setNotice(`Share this link: ${url}`);
      }
      analytics.track('shared_teleprompter_link', {
        method: capabilities.webShare ? 'native' : 'clipboard',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice(`Share this link: ${url}`);
    }
  };

  const start = async () => {
    if (!script.trim()) return;
    const firstLine = script.split('\n')[0] ?? '';
    const title = firstLine
      .replace(/^#+\s*/, '')
      .trim()
      .slice(0, 60);
    localStorage.setItem('teleprompter_active_title', title || 'Teleprompter Session');
    localStorage.setItem('teleprompter_active_script_content', script);
    if (preferences.voiceMode === 'smart') primeBrowserSpeechInUserGesture();

    // Trigger camera permission request during the start click user gesture (crucial for mobile Safari/Chrome)
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      try {
        const stream = await requestCameraStream();
        setPreloadedCameraStream(stream);
      } catch {
        // Ignored; Presenter will show permission prompt card
      }
    }
    setPresenting(true);
  };

  const stopPresenting = () => {
    setPresenting(false);
    requestAnimationFrame(() => startButtonRef.current?.focus());
  };

  return (
    <>
      <section
        class={`editor-shell${variant === 'compact' ? ' editor-shell--compact' : ''}`}
        aria-labelledby={embedded ? undefined : 'editor-title'}
        aria-label={embedded ? 'Practice teleprompter' : undefined}
        aria-busy={embedded && !hydrated ? 'true' : undefined}
        inert={embedded && !hydrated}
        data-hydrated={hydrated || undefined}
      >
        <div class="editor-heading">
          <div>
            <p class="eyebrow">{embedded ? 'Practice workspace' : 'Your script'}</p>
            <h2 id={embedded ? undefined : 'editor-title'}>
              {embedded ? 'Try it here.' : 'Ready when you are.'}
            </h2>
          </div>
          <div class="script-stats" aria-live="polite">
            <span>
              <b>{words.toLocaleString()}</b>{' '}
              {guide.kind === 'guided' ? 'spoken' : words === 1 ? 'word' : 'words'}
            </span>
            {guide.kind === 'guided' && (
              <span>
                <b>{guide.sections.length}</b> {guide.sections.length === 1 ? 'beat' : 'beats'}
              </span>
            )}
            <span>
              <b>{formatDuration(duration)}</b> at {preferences.speakingWpm} WPM
            </span>
            {preferences.targetDurationSeconds > 0 && words > 0 && (
              <span data-testid="required-pace">
                needs <b>{Math.round(requiredWpm(words, preferences.targetDurationSeconds))}</b> WPM
                to finish in {formatDuration(preferences.targetDurationSeconds)}
              </span>
            )}
          </div>
        </div>

        <label class="sr-only" for="script-editor">
          Teleprompter script
        </label>
        <textarea
          id="script-editor"
          class="script-editor"
          value={script}
          onInput={(event) => setScript(event.currentTarget.value)}
          placeholder={'Paste or type your script here.\n\nParagraph breaks will be preserved.'}
          spellcheck
          autocapitalize="sentences"
        />

        <div class="editor-meta">
          <span class="save-status">
            <i aria-hidden="true" />
            {saveStatus}
          </span>
          <label class="wpm-control">
            Speaking pace
            <select
              value={preferences.speakingWpm}
              onChange={(event) =>
                updatePreferences(
                  { ...preferences, speakingWpm: Number(event.currentTarget.value) },
                  'speakingWpm',
                )
              }
            >
              {Array.from(
                {
                  length:
                    (SETTING_LIMITS.speakingWpm.max - SETTING_LIMITS.speakingWpm.min) / 10 + 1,
                },
                (_, index) => SETTING_LIMITS.speakingWpm.min + index * 10,
              ).map((wpm) => (
                <option value={wpm}>{wpm} WPM</option>
              ))}
            </select>
          </label>
          <label class="wpm-control">
            Finish in
            <select
              value={preferences.targetDurationSeconds}
              onChange={(event) =>
                updatePreferences(
                  { ...preferences, targetDurationSeconds: Number(event.currentTarget.value) },
                  'targetDurationSeconds',
                )
              }
            >
              <option value={0}>No limit</option>
              {[1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                <option value={minutes * 60}>{minutes} min</option>
              ))}
            </select>
          </label>
        </div>

        <div class="editor-actions">
          <button
            ref={startButtonRef}
            class="button button--primary button--start"
            disabled={!script.trim()}
            onClick={start}
          >
            Start teleprompter <span aria-hidden="true">→</span>
          </button>
          <div class="secondary-actions">
            <a href="/scripts" class="text-button text-button--library">
              📚 Script Library
            </a>
            <input
              ref={importRef}
              class="sr-only"
              id="txt-import"
              type="file"
              aria-label="Import TXT file"
              accept=".txt,text/plain"
              onChange={(event) => void importText(event.currentTarget.files?.[0])}
            />
            <button class="text-button" onClick={() => importRef.current?.click()}>
              Import TXT
            </button>
            <button class="text-button" onClick={clearScript}>
              Clear script
            </button>
            <button class="text-button" onClick={() => void share()}>
              Share
            </button>
          </div>
        </div>
        <p class="editor-notice" role="status" aria-live="polite">
          {notice}
          {!notice && guide.kind === 'guided'
            ? 'Production script detected. Visual cues stay off the reading line.'
            : ''}
        </p>

        <details class="local-data-details">
          <summary>Privacy & local data</summary>
          <p>
            Your script is stored only in this browser. It is never added to a URL or sent to us.
          </p>
          <button class="text-button text-button--danger" onClick={clearEverything}>
            Clear local data
          </button>
        </details>
      </section>

      {presenting && (
        <Presenter
          script={script}
          preferences={preferences}
          entryContext={entryContextRef.current}
          initialCameraStream={preloadedCameraStream}
          onPreferencesChange={updatePreferences}
          onExit={stopPresenting}
        />
      )}
    </>
  );
}
