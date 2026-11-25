'use client';

import { useCampusLanguage } from '@/components/campus-language';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2, VolumeX, X, LoaderCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  CampusRecorder,
  CampusSpeechPlayer,
  voiceResponse,
} from '@/lib/campus-voice-client';

type Phase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'recognizing'
  | 'thinking'
  | 'synthesizing'
  | 'speaking';
export function CampusVoiceControls({
  active,
  ready,
  busy,
  onTranscript,
  onCancel,
}: {
  active: boolean;
  ready: boolean;
  busy: boolean;
  onTranscript: (text: string) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const { t } = useCampusLanguage();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [spoken, setSpoken] = useState(true);
  const spokenRef = useRef(true);
  const phaseRef = useRef<Phase>('idle');
  const recorder = useRef<CampusRecorder | null>(null);
  const player = useRef<CampusSpeechPlayer | null>(null);
  const lifecycle = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const held = useRef(false);
  const mounted = useRef(true);
  const cancelModel = useRef(onCancel);
  cancelModel.current = onCancel;
  const setStage = (next: Phase) => {
    phaseRef.current = next;
    if (mounted.current) setPhase(next);
  };
  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const cancel = () => {
    held.current = false;
    clearTimer();
    lifecycle.current?.abort();
    lifecycle.current = null;
    recorder.current?.cancel();
    recorder.current = null;
    player.current?.stop();
    if (phaseRef.current === 'thinking') cancelModel.current();
    setStage('idle');
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
      player.current?.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    if (!active || !ready) cancel();
    if (!active) return;
    const controller = new AbortController();
    fetch('/api/campus-voice', { signal: controller.signal, cache: 'no-store' })
      .then(voiceResponse)
      .then((result) => {
        if (!controller.signal.aborted)
          setConfigured(
            !!result &&
              typeof result === 'object' &&
              'configured' in result &&
              result.configured === true,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigured(false);
      });
    const visibility = () => {
      if (document.hidden) cancel();
    };
    const blur = () => {
      if (held.current) cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('keydown', escape);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('keydown', escape);
      cancel();
    };
  }, [active, ready]);
  const speak = async (text: string, signal: AbortSignal) => {
    setStage('synthesizing');
    await player.current!.play(text, signal, () => setStage('speaking'));
  };
  const finish = async () => {
    held.current = false;
    clearTimer();
    const controller = lifecycle.current,
      capture = recorder.current;
    if (!controller || !capture) return;
    if (phaseRef.current === 'preparing') {
      cancel();
      return;
    }
    if (phaseRef.current !== 'recording') return;
    setStage('recognizing');
    try {
      const audio = await capture.stop();
      controller.signal.throwIfAborted();
      if (recorder.current === capture) recorder.current = null;
      const response = await fetch('/api/campus-voice/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audio,
        signal: controller.signal,
      });
      const result = await voiceResponse(response);
      if (
        !result ||
        typeof result !== 'object' ||
        !('text' in result) ||
        typeof result.text !== 'string' ||
        !result.text.trim()
      )
        throw new Error('没有听清，请再说一次。');
      controller.signal.throwIfAborted();
      setTranscript(result.text);
      setStage('thinking');
      const answer = await onTranscript(result.text);
      controller.signal.throwIfAborted();
      if (answer) {
        setReply(answer);
        if (spokenRef.current) await speak(answer, controller.signal);
      }
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : '语音对话未完成，请重试。',
        );
    } finally {
      if (lifecycle.current === controller) {
        lifecycle.current = null;
        setStage('idle');
      }
    }
  };
  const start = async () => {
    if (
      !ready ||
      !configured ||
      busy ||
      held.current ||
      !['idle', 'speaking', 'synthesizing'].includes(phaseRef.current)
    )
      return;
    cancel();
    setError('');
    setTranscript('');
    setReply('');
    held.current = true;
    player.current ??= new CampusSpeechPlayer();
    void player.current.unlock();
    const controller = new AbortController();
    lifecycle.current = controller;
    const capture = new CampusRecorder();
    recorder.current = capture;
    setSeconds(0);
    setStage('preparing');
    try {
      await capture.start(controller.signal);
      if (controller.signal.aborted || !held.current) {
        capture.cancel();
        return;
      }
      setStage('recording');
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setSeconds(Math.min(30, Math.floor(elapsed)));
        if (elapsed >= 30) void finish();
      }, 200);
    } catch (reason) {
      capture.cancel();
      if (!controller.signal.aborted) {
        const denied =
          reason instanceof DOMException && reason.name === 'NotAllowedError';
        setError(
          denied
            ? '麦克风权限未开启。请允许此页面使用麦克风，然后重试。'
            : reason instanceof Error
              ? reason.message
              : '无法打开麦克风。',
        );
        cancel();
      }
    }
  };
  const replay = async () => {
    cancel();
    setError('');
    player.current ??= new CampusSpeechPlayer();
    const unlocked = player.current.unlock();
    const controller = new AbortController();
    lifecycle.current = controller;
    try {
      await unlocked;
      controller.signal.throwIfAborted();
      await speak(reply, controller.signal);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : '无法播放回复。');
    } finally {
      if (lifecycle.current === controller) {
        lifecycle.current = null;
        setStage('idle');
      }
    }
  };
  const labels: Record<Phase, string> = {
    idle: '按住说话',
    preparing: '正在打开麦克风…',
    recording: `正在聆听 ${seconds}s · 松开发送`,
    recognizing: '正在识别…',
    thinking: '正在查询校园…',
    synthesizing: '正在准备语音…',
    speaking: '正在播报 · 按住可打断',
  };
  const waiting = ['recognizing', 'thinking'].includes(phase);
  return (
    <div className="campus-voice" hidden={!active}>
      <p className="voice-example">
        {t('试着说：“我在日晷广场，想去图书馆。”')}
      </p>
      <button
        type="button"
        className={`voice-hold ${phase === 'recording' ? 'recording' : ''}`}
        disabled={!ready || !configured || busy || waiting}
        aria-label={t('按住说话，松开发送')}
        aria-pressed={phase === 'recording'}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          void start();
        }}
        onPointerUp={(event) => {
          void finish();
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => cancel()}
        onLostPointerCapture={() => {
          if (held.current) cancel();
        }}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if ([' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            if (!event.repeat) void start();
          }
        }}
        onKeyUp={(event) => {
          if ([' ', 'Enter'].includes(event.key)) {
            event.preventDefault();
            void finish();
          }
        }}
        onBlur={() => {
          if (held.current) cancel();
        }}
      >
        {waiting ? (
          <LoaderCircle size={22} className="spin" />
        ) : (
          <Mic size={24} />
        )}
        <span>{t(labels[phase])}</span>
      </button>
      <div className="voice-options">
        <label htmlFor="voice-spoken-replies">
          <Volume2 size={15} />
          {t('语音回复')}
          <Switch
            id="voice-spoken-replies"
            checked={spoken}
            onCheckedChange={(value) => {
              setSpoken(value);
              spokenRef.current = value;
              if (
                !value &&
                ['speaking', 'synthesizing'].includes(phaseRef.current)
              )
                cancel();
            }}
          />
        </label>
        {phase !== 'idle' && (
          <button type="button" onClick={cancel}>
            {phase === 'recording' || phase === 'preparing' ? (
              <X size={14} />
            ) : (
              <Square size={13} />
            )}
            {t('取消')}
          </button>
        )}
        {reply && phase === 'idle' && (
          <button type="button" onClick={() => void replay()}>
            <Volume2 size={14} />
            {t('播放回复')}
          </button>
        )}
      </div>
      <p className="voice-status" role="status">
        {t(
          configured === null
            ? '正在检查语音配置…'
            : !configured
              ? '语音服务尚未配置，可继续使用文字提问。'
              : phase === 'idle'
                ? '按住录音，松开发送；最多 30 秒。首次请先允许麦克风权限。'
                : labels[phase],
        )}
      </p>
      {transcript && (
        <p className="voice-transcript">
          {t('听到：')}
          {transcript}
        </p>
      )}
      {error && (
        <p className="assistant-request-error" role="alert">
          <VolumeX size={14} />
          {t(error)}
        </p>
      )}
      <p className="voice-privacy">
        {t(
          '松开后，录音发送至豆包识别；问题交给 DeepSeek，回复由豆包播报。本应用不保存录音。',
        )}
      </p>
    </div>
  );
}
