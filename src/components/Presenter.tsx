import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  analytics,
  durationBucket,
  progressBucket,
  scriptSizeBucket,
  voiceModeParam,
  type EntryContext,
  type SettingName,
} from '../domain/analytics';
import { countWords, formatDuration } from '../domain/calculations';
import {
  compileScriptGuide,
  cueSummary,
  firstCueLine,
  sectionAtSpokenOffset,
} from '../domain/scriptGuide';
import { detectBrowserCapabilities } from '../domain/capabilities';
import {
  estimateFocusCharacterIndex,
  highlightWindowAround,
  scrollOffsetForCharacter,
  segmentScript,
  type HighlightWindow,
} from '../domain/scriptHighlight';
import {
  PaceCueEngine,
  formatDrift,
  plannedSecondsAtWord,
  plannedTotalSeconds,
  type CueState,
} from '../domain/pacePlan';
import { SETTING_LIMITS, clamp, speedToPixelsPerSecond } from '../domain/settings';
import { TimeBasedScrollController } from '../domain/scrollController';
import type { PresenterPreferences } from '../domain/types';
import PictureInPictureControl from './PictureInPictureControl';
import RecordingControl from './RecordingControl';
import SettingControls from './SettingControls';
import VoiceTrackingControls from './VoiceTrackingControls';

export async function requestCameraStream(): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.mediaDevices?.getUserMedia !== 'function'
  ) {
    throw new Error('media-devices-unsupported');
  }

  // 1. Mobile front camera (flexible ideal constraints)
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (err1) {
    console.warn('Flexible ideal camera constraints failed:', err1);
  }

  // 2. Strict facingMode: 'user' without resolution constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
  } catch (err2) {
    console.warn('FacingMode user failed:', err2);
  }

  // 3. Fallback to any available video stream
  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
}

interface Props {
  script: string;
  preferences: PresenterPreferences;
  entryContext: EntryContext;
  initialCameraStream?: MediaStream | null;
  onPreferencesChange: (next: PresenterPreferences, setting?: SettingName) => void;
  onExit: () => void;
}

const INTERACTION_HIDE_DELAY = 2800;
// The chip announces a change once, then gets out of the way.
const CHIP_VISIBLE_MS = 2500;
// A session counts as complete when the scroll reaches at least 95% of the script or hits
// the explicit end-of-script state reported by the scroll controller.
const COMPLETE_PROGRESS_THRESHOLD = 0.95;

export default function Presenter({
  script,
  preferences,
  entryContext,
  initialCameraStream,
  onPreferencesChange,
  onExit,
}: Props): preact.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const presenterRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<TimeBasedScrollController | null>(null);
  const settingsPanelRef = useRef<HTMLElement>(null);
  const shortcutsPanelRef = useRef<HTMLElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDoneRef = useRef<HTMLButtonElement>(null);
  const shortcutsDoneRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsOpenRef = useRef(false);
  const shortcutsOpenRef = useRef(false);
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [voiceListening, setVoiceListening] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(initialCameraStream ?? null);
  const [cameraPermissionDismissed, setCameraPermissionDismissed] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    'idle' | 'prompt' | 'granted' | 'denied' | 'insecure_context'
  >(() => {
    if (initialCameraStream) return 'granted';
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext === false &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return 'insecure_context';
    }
    return 'prompt';
  });

  useEffect(() => {
    let active = true;
    if (cameraStream) return;

    if (
      typeof window !== 'undefined' &&
      window.isSecureContext === false &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setCameraStatus('insecure_context');
      return;
    }

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      requestCameraStream()
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          setCameraStream(stream);
          setCameraStatus('granted');
        })
        .catch((err) => {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraStatus('denied');
          } else {
            setCameraStatus('prompt');
          }
          console.warn('Default camera preview could not be started:', err);
        });
    } else {
      setCameraStatus('insecure_context');
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const handleRequestCamera = async () => {
    try {
      const stream = await requestCameraStream();
      setCameraStream(stream);
      setCameraStatus('granted');
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
      } else {
        setCameraStatus('prompt');
      }
      console.warn('Camera permission request error:', err);
    }
  };

  const toggleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    } else {
      await handleRequestCamera();
    }
  };
  // The highlight is applied straight to the DOM rather than held in state. It changes at word
  // rate while the scroll updates every frame, and rendering it through Preact re-diffed every
  // word span in the script on each frame.
  const wordNodesRef = useRef<HTMLElement[]>([]);
  const wordStartsRef = useRef<Int32Array>(new Int32Array(0));
  const appliedRef = useRef<HighlightWindow>({ trailStart: -1, liveStart: -1, liveEnd: -1 });
  const [liveStart, setLiveStart] = useState(0);
  // Which word the speaker is on, used by the pace cue. Comes from the aligner while following and
  // from scroll progress otherwise, so cues work in Manual mode too.
  const spokenWordRef = useRef(0);
  const followingRef = useRef(false);
  const cueEngineRef = useRef(new PaceCueEngine());
  // Speaking time, not wall-clock: a pause is not falling behind.
  const spokenMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const [cue, setCue] = useState<CueState>('steady');
  const [driftLabel, setDriftLabel] = useState('');
  const [chipVisible, setChipVisible] = useState(false);
  const chipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cueRef = useRef<CueState>('steady');
  const [cueStrength, setCueStrength] = useState(0);
  const voiceMultiplierRef = useRef(1);
  const scriptElementRef = useRef<HTMLDivElement>(null);
  const precisionAnchorRef = useRef<number | null>(null);
  const guide = useMemo(
    () => compileScriptGuide(script, preferences.speakingWpm),
    [script, preferences.speakingWpm],
  );
  const displayScript = guide.kind === 'guided' ? guide.spokenText : script;
  const segments = useMemo(() => segmentScript(displayScript), [displayScript]);
  const segmentsRef = useRef(segments);
  const focusPositionRef = useRef(preferences.focusPosition);
  segmentsRef.current = segments;
  focusPositionRef.current = preferences.focusPosition;
  settingsOpenRef.current = settingsOpen;
  shortcutsOpenRef.current = shortcutsOpen;
  const capabilities = useRef(detectBrowserCapabilities()).current;
  const words = guide.kind === 'guided' ? guide.spokenWordCount : countWords(script);
  const planTotalSeconds = plannedTotalSeconds(
    words,
    preferences.speakingWpm,
    preferences.targetDurationSeconds,
  );
  const planRef = useRef({ words, totalSeconds: planTotalSeconds, cuesOn: preferences.paceCues });
  planRef.current = { words, totalSeconds: planTotalSeconds, cuesOn: preferences.paceCues };
  // The readout follows whatever plan is in force, so setting a finish time changes what the
  // presenter is told is left rather than leaving a stale rate-based estimate on screen.
  const remaining = planTotalSeconds * (1 - progress);
  const activeSection = sectionAtSpokenOffset(guide, precisionAnchorRef.current ?? liveStart);
  const visualCue = cueSummary(activeSection, 'visual');
  const screenCue = cueSummary(activeSection, 'screen');

  /** Index of the first cached word span starting at or after `character`. */
  const wordIndexAt = (character: number): number => {
    const starts = wordStartsRef.current;
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((starts[middle] ?? 0) < character) low = middle + 1;
      else high = middle;
    }
    return low;
  };

  /** Touch only the spans that entered or left the window, never the whole script. */
  const applyHighlight = (next: HighlightWindow) => {
    const applied = appliedRef.current;
    if (
      applied.trailStart === next.trailStart &&
      applied.liveStart === next.liveStart &&
      applied.liveEnd === next.liveEnd
    ) {
      return;
    }
    const nodes = wordNodesRef.current;
    if (!nodes.length) return;

    const clear = (from: number, to: number) => {
      for (let index = from; index < to; index += 1) {
        nodes[index]?.classList.remove('script-word--live', 'script-word--trail');
      }
    };
    if (applied.trailStart >= 0) {
      clear(wordIndexAt(applied.trailStart), wordIndexAt(applied.liveEnd));
    }

    const trailFrom = wordIndexAt(next.trailStart);
    const liveFrom = wordIndexAt(next.liveStart);
    const liveTo = wordIndexAt(next.liveEnd);
    for (let index = trailFrom; index < liveFrom; index += 1) {
      nodes[index]?.classList.add('script-word--trail');
    }
    for (let index = liveFrom; index < liveTo; index += 1) {
      nodes[index]?.classList.add('script-word--live');
    }

    appliedRef.current = next;
    setLiveStart(next.liveStart);
  };
  const applyHighlightRef = useRef(applyHighlight);
  applyHighlightRef.current = applyHighlight;

  const syncHighlightFromScroll = () => {
    const scroller = scrollerRef.current;
    const scriptElement = scriptElementRef.current;
    if (!scroller || !scriptElement || !displayScript.length) return;
    // Precision anchors temporarily own the live word when speech recognition is confident.
    // Otherwise the focus-line caret estimate keeps Smart Pace and the reader visually aligned.
    const center =
      precisionAnchorRef.current ??
      estimateFocusCharacterIndex(
        scroller,
        scriptElement,
        focusPositionRef.current,
        displayScript.length,
      );
    applyHighlightRef.current(highlightWindowAround(segmentsRef.current, center));
  };
  const syncHighlightRef = useRef(syncHighlightFromScroll);
  syncHighlightRef.current = syncHighlightFromScroll;

  /**
   * Compare where the speaker is against where the plan says they should be. Driven from the
   * scroll snapshot, which arrives about eight times a second, so it never runs per frame.
   */
  const evaluateCue = (progressValue: number, isPlaying: boolean) => {
    const now = performance.now();
    const previous = lastTickRef.current;
    // Dropping the mark while paused stops the first tick after a resume from charging the whole
    // pause to the speaker. A pause is not falling behind.
    lastTickRef.current = isPlaying ? now : null;
    if (isPlaying && previous !== null) {
      spokenMsRef.current += Math.min(1000, now - previous);
    }

    const plan = planRef.current;
    if (!plan.cuesOn || plan.words <= 0 || plan.totalSeconds <= 0) {
      if (cueRef.current !== 'steady') {
        cueRef.current = 'steady';
        setCue('steady');
      }
      setDriftLabel('');
      return;
    }

    // While following, the aligner knows the word. Otherwise scroll progress is the best estimate,
    // which is what makes the cue work in Manual mode as well.
    const wordIndex = followingRef.current
      ? spokenWordRef.current
      : Math.round(progressValue * plan.words);

    const reading = cueEngineRef.current.update({
      plannedSeconds: plannedSecondsAtWord(wordIndex, plan.words, plan.totalSeconds),
      elapsedSeconds: spokenMsRef.current / 1000,
      totalSeconds: plan.totalSeconds,
      at: now,
    });

    setDriftLabel(formatDrift(reading.driftSeconds));
    setCueStrength(reading.magnitude);

    if (reading.state === cueRef.current) return;
    cueRef.current = reading.state;
    setCue(reading.state);
    if (reading.state === 'steady') {
      setChipVisible(false);
      return;
    }
    // The chip says it once; the tick offset keeps saying it quietly.
    setChipVisible(true);
    if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
    chipTimerRef.current = setTimeout(() => setChipVisible(false), CHIP_VISIBLE_MS);
    analytics.track('pace_cue_shown', { cue: reading.state });
  };
  const evaluateCueRef = useRef(evaluateCue);
  evaluateCueRef.current = evaluateCue;

  const revealControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playing && !settingsOpen && !shortcutsOpen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), INTERACTION_HIDE_DELAY);
    }
  };

  // Cache the word spans once per script so the highlight can address them by binary search
  // instead of querying the DOM on every update.
  useLayoutEffect(() => {
    const scriptElement = scriptElementRef.current;
    if (!scriptElement) return;
    const nodes = Array.from(scriptElement.querySelectorAll<HTMLElement>('[data-script-word]'));
    wordNodesRef.current = nodes;
    const starts = new Int32Array(nodes.length);
    nodes.forEach((node, index) => {
      starts[index] = Number(node.dataset.start ?? 0);
    });
    wordStartsRef.current = starts;
    appliedRef.current = { trailStart: -1, liveStart: -1, liveEnd: -1 };
    syncHighlightRef.current();
  }, [displayScript]);

  useLayoutEffect(() => {
    document.body.classList.add('presenting');
    const background = document.querySelectorAll<HTMLElement>(
      '.site-header, .site-footer, .home-hero__copy, .editor-shell, .home-content, .privacy-choices, .privacy-preference',
    );
    background.forEach((element) => {
      element.inert = true;
    });
    presenterRef.current?.focus();
    const element = scrollerRef.current;
    if (!element) return;

    const markComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      analytics.track('finished_teleprompter');
    };
    const controller = new TimeBasedScrollController({
      element,
      pixelsPerSecond: speedToPixelsPerSecond(preferences.baseScrollSpeed),
      onUpdate: (snapshot) => {
        progressRef.current = snapshot.progress;
        setPlaying((current) => (current === snapshot.isPlaying ? current : snapshot.isPlaying));
        // Half a percent is finer than the readout can show, so anything smaller is a wasted
        // render of the whole script.
        setProgress((current) =>
          Math.round(current * 200) === Math.round(snapshot.progress * 200)
            ? current
            : snapshot.progress,
        );
        if (snapshot.progress >= COMPLETE_PROGRESS_THRESHOLD) markComplete();
        syncHighlightRef.current();
        evaluateCueRef.current(snapshot.progress, snapshot.isPlaying);
      },
      onComplete: markComplete,
    });
    controllerRef.current = controller;
    const startTimer = setTimeout(() => controller.start(), 350);
    analytics.track('started_teleprompter', {
      voice_mode: voiceModeParam(preferences.voiceMode),
      script_size_bucket: scriptSizeBucket(words),
      entry_context: entryContext,
      script_kind: guide.kind === 'guided' ? 'production' : 'plain',
    });

    return () => {
      clearTimeout(startTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
      controller.destroy();
      controllerRef.current = null;
      document.body.classList.remove('presenting');
      background.forEach((element) => {
        element.inert = false;
      });
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setSpeed(
      speedToPixelsPerSecond(preferences.baseScrollSpeed) * voiceMultiplierRef.current,
    );
  }, [preferences.baseScrollSpeed]);

  // Smart Pace without speech recognition has only microphone energy to go on, so the rhythm
  // multiplier still sets the base speed. When an alignment target exists the servo owns the
  // velocity and this only shapes the carrier underneath it.
  const updateVoiceMultiplier = (multiplier: number) => {
    voiceMultiplierRef.current = multiplier;
    controllerRef.current?.setSpeed(
      speedToPixelsPerSecond(preferences.baseScrollSpeed) * multiplier,
    );
  };

  const applyAlignment = (
    characterIndex: number,
    tokenEnd: number,
    confidence: number,
    wordsPerMinute: number,
  ) => {
    const scroller = scrollerRef.current;
    const scriptElement = scriptElementRef.current;
    if (!scroller || !displayScript.length) return;

    const focused =
      scriptElement &&
      scrollOffsetForCharacter(scroller, scriptElement, characterIndex, focusPositionRef.current);
    const target =
      typeof focused === 'number'
        ? focused
        : (characterIndex / displayScript.length) *
          Math.max(0, scroller.scrollHeight - scroller.clientHeight);

    // Feed-forward from the speaker's own rate, so the reader keeps moving between alignments
    // instead of waiting to be pushed. Pixels per word is measured from the rendered script.
    const wordCount = wordNodesRef.current.length;
    const pixelsPerWord = wordCount > 0 ? scroller.scrollHeight / wordCount : 0;
    const feedForward = (Math.max(0, wordsPerMinute) / 60) * pixelsPerWord;

    if (controllerRef.current) {
      controllerRef.current.setFollowTarget(target, confidence, feedForward);
    } else {
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTop = Math.min(max, Math.max(0, target));
    }

    const center =
      tokenEnd > characterIndex ? Math.round((characterIndex + tokenEnd) / 2) : characterIndex;
    precisionAnchorRef.current = center;
    spokenWordRef.current = wordIndexAt(center);
    applyHighlightRef.current(highlightWindowAround(segmentsRef.current, center, 6, 3));
  };

  const handleVoiceActivity = (activity: { listening: boolean; speechActive: boolean }) => {
    setVoiceListening(activity.listening);
    setSpeechActive(activity.speechActive);
    followingRef.current = activity.listening;
    if (!activity.listening) {
      precisionAnchorRef.current = null;
      // Hand the reader back to plain time-based scrolling rather than leaving it chasing a
      // target that will never be updated again.
      controllerRef.current?.setFollowTarget(null, 0, 0);
    } else {
      requestAnimationFrame(() => syncHighlightRef.current());
    }
  };

  useEffect(() => {
    controllerRef.current?.setLineHeight(preferences.fontSize * preferences.lineHeight);
    controllerRef.current?.notifyLayoutChange();
  }, [
    preferences.fontSize,
    preferences.lineHeight,
    preferences.textWidth,
    preferences.focusPosition,
  ]);

  useEffect(() => {
    const onFullscreen = () => {
      const next = Boolean(document.fullscreenElement);
      setFullscreen(next);
      analytics.track(next ? 'entered_fullscreen' : 'exited_fullscreen');
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    if (settingsOpen) settingsDoneRef.current?.focus();
  }, [settingsOpen]);

  useEffect(() => {
    if (shortcutsOpen) shortcutsDoneRef.current?.focus();
  }, [shortcutsOpen]);

  useEffect(() => {
    const onResize = () => controllerRef.current?.notifyLayoutChange();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    revealControls();
  }, [playing, settingsOpen, shortcutsOpen]);

  const togglePlay = (controlSource: 'button' | 'keyboard' = 'button') => {
    if (playing) {
      controllerRef.current?.pause();
      analytics.track('paused_teleprompter', { control_source: controlSource });
      setControlsVisible(true);
    } else {
      if (progress >= 0.999) controllerRef.current?.restart();
      controllerRef.current?.start();
      analytics.track('resumed_teleprompter', { control_source: controlSource });
      revealControls();
    }
  };

  const updatePreference = <K extends keyof PresenterPreferences>(
    key: K,
    value: PresenterPreferences[K],
  ) => onPreferencesChange({ ...preferences, [key]: value }, key);

  const changeSpeed = (amount: number) => {
    updatePreference(
      'baseScrollSpeed',
      clamp(
        preferences.baseScrollSpeed + amount,
        SETTING_LIMITS.baseScrollSpeed.min,
        SETTING_LIMITS.baseScrollSpeed.max,
      ),
    );
  };

  const changeFont = (amount: number) => {
    updatePreference(
      'fontSize',
      clamp(
        preferences.fontSize + amount,
        SETTING_LIMITS.fontSize.min,
        SETTING_LIMITS.fontSize.max,
      ),
    );
  };

  const toggleFullscreen = async () => {
    if (!capabilities.fullscreen) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setControlsVisible(true);
    }
  };

  const exit = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // The presenter can still close if the browser refuses to exit fullscreen.
      }
    }
    // Exit only fires when the session did not complete, so it never doubles with
    // teleprompter_complete.
    if (!completedRef.current) {
      analytics.track('left_teleprompter_early', {
        progress_bucket: progressBucket(progressRef.current),
        duration_bucket: durationBucket((Date.now() - startedAtRef.current) / 1000),
        voice_mode: voiceModeParam(preferences.voiceMode),
      });
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    onExit();
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const closeShortcuts = () => {
    setShortcutsOpen(false);
    requestAnimationFrame(() => shortcutsButtonRef.current?.focus());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (event.key === 'Escape') {
        if (settingsOpenRef.current) closeSettings();
        else if (shortcutsOpenRef.current) closeShortcuts();
        else void exit();
        return;
      }

      if (event.key === 'Tab') {
        const panel = settingsOpenRef.current
          ? settingsPanelRef.current
          : shortcutsOpenRef.current
            ? shortcutsPanelRef.current
            : presenterRef.current;
        const focusable = panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable?.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first || !panel?.contains(document.activeElement))
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        return;
      }

      if (target?.matches('input, textarea, select, button')) return;

      const key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay('keyboard');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        changeSpeed(1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        changeSpeed(-1);
      } else if (event.key === '[') {
        changeFont(-2);
      } else if (event.key === ']') {
        changeFont(2);
      } else if (key === 'f') {
        void toggleFullscreen();
      } else if (key === 'm') {
        updatePreference('mirror', !preferences.mirror);
      } else if (event.key === 'Home') {
        event.preventDefault();
        controllerRef.current?.restart();
        analytics.track('restarted_teleprompter', { control_source: 'keyboard' });
      }
      revealControls();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [playing, preferences, settingsOpen, shortcutsOpen]);

  const cueClass =
    preferences.paceCues && cue !== 'steady'
      ? cue === 'push'
        ? 'focus-guide--push'
        : 'focus-guide--ease'
      : '';
  const cueAnnouncement =
    !preferences.paceCues || cue === 'steady'
      ? ''
      : cue === 'push'
        ? 'Running behind. Pick up the pace.'
        : 'Running ahead. Ease off.';

  const restart = () => {
    spokenMsRef.current = 0;
    lastTickRef.current = null;
    cueEngineRef.current.reset();
    cueRef.current = 'steady';
    setCue('steady');
    setChipVisible(false);
    controllerRef.current?.restart();
    analytics.track('restarted_teleprompter', { control_source: 'button' });
    revealControls();
  };

  return (
    <section
      ref={presenterRef}
      class={`presenter ${controlsVisible || !playing ? 'presenter--controls' : ''} ${voiceListening ? 'presenter--listening' : ''} ${speechActive ? 'presenter--speaking' : ''} ${cameraStream ? 'presenter--camera' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Teleprompter presenter"
      tabIndex={-1}
      autoFocus
      onPointerMove={revealControls}
      onPointerDown={revealControls}
    >
      {cameraStream && (
        <div class="presenter__camera-backdrop" aria-hidden="true">
          <video
            ref={(element) => {
              if (element && element.srcObject !== cameraStream) {
                element.srcObject = cameraStream;
                element.play().catch(() => {});
              }
            }}
            class="presenter__camera-video"
            style={{
              transform: `scaleX(${preferences.mirror ? 1 : -1})`,
            }}
            autoPlay
            playsInline
            muted
          />
          <div class="presenter__camera-overlay" />
        </div>
      )}

      {!cameraStream && !cameraPermissionDismissed && (
        <div class="presenter-camera-prompt" role="region" aria-label="Camera permission prompt">
          <div class="presenter-camera-prompt__card">
            <div class="presenter-camera-prompt__icon">📷</div>
            <div class="presenter-camera-prompt__info">
              <strong>
                {cameraStatus === 'insecure_context'
                  ? '🔒 Secure Connection Required for Mobile Camera'
                  : cameraStatus === 'denied'
                    ? '⚠️ Camera Permission Blocked'
                    : '📷 Camera Backdrop Available'}
              </strong>
              <p>
                {cameraStatus === 'insecure_context'
                  ? 'Mobile browsers require a secure connection (HTTPS) for camera permissions over Wi-Fi/LAN.'
                  : cameraStatus === 'denied'
                    ? 'Camera was blocked. Tap below to re-request camera permission.'
                    : 'Tap below to grant camera access and show your camera backdrop behind the text.'}
              </p>
            </div>
            <div class="presenter-camera-prompt__actions">
              {cameraStatus === 'insecure_context' ? (
                <a
                  href={
                    typeof window !== 'undefined'
                      ? `https://${window.location.hostname}:4323${window.location.pathname}${window.location.search}`
                      : '#'
                  }
                  class="presenter-camera-prompt__btn presenter-camera-prompt__btn--primary"
                >
                  🔒 Switch to Secure HTTPS (:4323)
                </a>
              ) : (
                <button
                  type="button"
                  class="presenter-camera-prompt__btn presenter-camera-prompt__btn--primary"
                  onClick={handleRequestCamera}
                >
                  {cameraStatus === 'denied'
                    ? '🔄 Retry Camera Access'
                    : '📷 Allow Camera Permission'}
                </button>
              )}
              <button
                type="button"
                class="presenter-camera-prompt__btn presenter-camera-prompt__btn--dismiss"
                onClick={() => setCameraPermissionDismissed(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div class="presenter__progress" aria-hidden="true">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {preferences.focusLine && (
        <div
          class={`focus-guide ${cueClass}`}
          style={{
            top: `${preferences.focusPosition}%`,
            '--cue-strength': cueStrength.toFixed(2),
          }}
          aria-hidden="true"
        >
          <span />
          {cueClass && chipVisible && (
            <b class="pace-chip">{cue === 'push' ? 'Pick up' : 'Ease off'}</b>
          )}
        </div>
      )}

      {/* The cue is never colour or shape alone: it is also announced. */}
      <p class="sr-only" role="status" aria-live="polite">
        {cueAnnouncement}
      </p>

      {guide.kind === 'guided' && activeSection && (
        <aside class="guide-rail" aria-label="Production cues">
          {(visualCue || screenCue) && (
            <>
              {visualCue && (
                <p class="guide-rail__cue">
                  <span>Visual</span>
                  {firstCueLine(visualCue)}
                </p>
              )}
              {screenCue && <p class="guide-rail__super">{firstCueLine(screenCue)}</p>}
            </>
          )}
        </aside>
      )}

      <div
        ref={scrollerRef}
        class="presenter__scroll"
        data-testid="presenter-scroll"
        tabIndex={0}
        aria-label="Script scroll area"
      >
        <div
          class="presenter__script-wrap"
          style={{
            '--focus-position': `${preferences.focusPosition}vh`,
            '--text-width': `${preferences.textWidth}%`,
          }}
        >
          <div
            ref={scriptElementRef}
            class="presenter__script"
            style={{
              '--script-font-size': `${preferences.fontSize}px`,
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
              textAlign: preferences.alignment,
              transform: `scale(${preferences.mirror ? -1 : 1}, ${preferences.verticalFlip ? -1 : 1})`,
            }}
          >
            {segments.map((segment) =>
              segment.kind === 'gap' ? (
                <span key={`g-${segment.start}`}>{segment.text}</span>
              ) : (
                <span
                  key={`w-${segment.start}`}
                  class="script-word"
                  data-script-word="true"
                  data-start={segment.start}
                  data-end={segment.end}
                >
                  {segment.text}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <header class="presenter__topbar">
        <div class="presenter__brand">teleprompter</div>
        <div class="presenter__readout" aria-live="polite">
          <span>{Math.round(progress * 100)}%</span>
          <span>about {formatDuration(remaining)} left</span>
          {preferences.paceCues && driftLabel && (
            <span data-testid="pace-drift" class="presenter__drift">
              {driftLabel}
            </span>
          )}
          {guide.kind === 'guided' && activeSection && (
            <span data-testid="guide-beat">
              {activeSection.timecodeLabel ? `${activeSection.timecodeLabel} · ` : ''}
              {activeSection.title}
              {activeSection.fit === 'tight' ? ' · tight' : ''}
            </span>
          )}
        </div>
        <button class="control-button control-button--exit" onClick={() => void exit()}>
          Exit presenter
        </button>
      </header>

      <div class="presenter__controls">
        <div class="presenter__controls-primary">
          <button class="control-button control-button--primary" onClick={() => togglePlay('button')}>
            {playing ? 'Pause' : progress >= 1 ? 'Play again' : 'Resume'}
            <kbd>Space</kbd>
          </button>
          <div class="speed-stepper" aria-label="Scroll speed">
            <button class="control-button" onClick={() => changeSpeed(-1)} aria-label="Slower">
              −
            </button>
            <output aria-live="polite">
              <b>{preferences.baseScrollSpeed}</b>
              <span>Speed</span>
            </output>
            <button class="control-button" onClick={() => changeSpeed(1)} aria-label="Faster">
              +
            </button>
          </div>
          <button class="control-button" onClick={restart}>
            Restart
          </button>
        </div>
        <div class="presenter__controls-secondary">
          <VoiceTrackingControls
            script={displayScript}
            mode={preferences.voiceMode}
            onModeChange={(voiceMode) => updatePreference('voiceMode', voiceMode)}
            onMultiplier={updateVoiceMultiplier}
            onAlignment={applyAlignment}
            onVoiceActivity={handleVoiceActivity}
          />
          <RecordingControl
            cameraStream={cameraStream}
            onCameraStreamChange={setCameraStream}
            onRecordingStart={() => {
              if (!playing) setPlaying(true);
            }}
          />
          <button
            class={`control-button ${cameraStream ? 'control-button--active' : ''}`}
            onClick={() => void toggleCamera()}
            title={cameraStream ? 'Turn off camera backdrop' : 'Turn on camera backdrop'}
            aria-label={cameraStream ? 'Turn off camera' : 'Turn on camera'}
          >
            {cameraStream ? 'Camera on' : 'Camera off'}
          </button>
          <PictureInPictureControl
            script={displayScript}
            progress={progress}
            playing={playing}
            onTogglePlay={togglePlay}
          />
          <button
            ref={settingsButtonRef}
            class="control-button"
            onClick={() => {
              analytics.track('opened_appearance_panel');
              setSettingsOpen(true);
            }}
          >
            Appearance
          </button>
          <button
            ref={shortcutsButtonRef}
            class="control-button control-button--shortcuts"
            onClick={() => {
              analytics.track('opened_shortcuts_panel');
              setShortcutsOpen(true);
            }}
          >
            Shortcuts
          </button>
          {capabilities.fullscreen && (
            <button class="control-button" onClick={() => void toggleFullscreen()}>
              {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div class="presenter__scrim" onClick={closeSettings}>
          <section
            ref={settingsPanelRef}
            class="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Presenter settings</p>
                <h2 id="appearance-title">Appearance</h2>
              </div>
              <button ref={settingsDoneRef} class="control-button" onClick={closeSettings}>
                Done
              </button>
            </div>
            <SettingControls preferences={preferences} onChange={onPreferencesChange} />
          </section>
        </div>
      )}

      {shortcutsOpen && (
        <div class="presenter__scrim" onClick={closeShortcuts}>
          <section
            ref={shortcutsPanelRef}
            class="shortcuts-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Keyboard</p>
                <h2 id="shortcuts-title">Shortcuts</h2>
              </div>
              <button ref={shortcutsDoneRef} class="control-button" onClick={closeShortcuts}>
                Done
              </button>
            </div>
            <dl class="shortcut-list">
              <div>
                <dt>
                  <kbd>Space</kbd>
                </dt>
                <dd>Play or pause</dd>
              </div>
              <div>
                <dt>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>Faster or slower</dd>
              </div>
              <div>
                <dt>
                  <kbd>[</kbd> <kbd>]</kbd>
                </dt>
                <dd>Smaller or larger text</dd>
              </div>
              <div>
                <dt>
                  <kbd>F</kbd>
                </dt>
                <dd>Toggle fullscreen</dd>
              </div>
              <div>
                <dt>
                  <kbd>M</kbd>
                </dt>
                <dd>Mirror horizontally</dd>
              </div>
              <div>
                <dt>
                  <kbd>Home</kbd>
                </dt>
                <dd>Return to the beginning</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Close or exit presenter</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
