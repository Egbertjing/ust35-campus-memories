'use client';

import { useCampusLanguage } from '@/components/campus-language';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Message, MessageContent, MessageGroup } from '@/components/ui/message';
import {
  runCampusAssistantTurn,
  type AssistantSceneContext,
  type AssistantTurn,
  type AssistantMessage,
} from '@/lib/campus-assistant';
import type { CampusToolHost, CampusToolResult } from '@/lib/campus-tools';
import { CampusVoiceControls } from '@/components/campus-voice-controls';
import { AssistantMarkdown } from '@/components/assistant-markdown';

type ChatRow = {
  id: string;
  question: string;
  actions: CampusToolResult[];
  reply?: string;
  error?: string;
};
const examples = [
  '图书馆在哪儿？',
  '我在日晷广场，去海滨运动场怎么走？',
  '找到李兆基商学大楼并显示标签',
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function CampusAssistantPanel({
  ready,
  host,
  getContext,
  active,
}: {
  ready: boolean;
  host: CampusToolHost | null;
  getContext: () => AssistantSceneContext;
  active: boolean;
}) {
  const { t } = useCampusLanguage();
  const [voiceMode, setVoiceMode] = useState(false);
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState<{
    configured: boolean;
    model: string;
    error?: string;
  } | null>(null);
  const history = useRef<AssistantTurn[]>([]);
  const request = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  useEffect(() => {
    const lifecycle = new AbortController();
    fetch('/api/campus-assistant', {
      signal: lifecycle.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const result = await response.json();
        if (!isRecord(result)) throw new Error('无法读取模型配置。');
        if (!response.ok)
          throw new Error(
            typeof result.error === 'string'
              ? result.error
              : '无法读取模型配置。',
          );
        setStatus({
          configured: result.configured === true,
          model: typeof result.model === 'string' ? result.model : 'DeepSeek',
        });
      })
      .catch((error) => {
        if (!lifecycle.signal.aborted)
          setStatus({
            configured: false,
            model: 'DeepSeek',
            error:
              error instanceof Error ? error.message : '无法读取模型配置。',
          });
      });
    return () => lifecycle.abort();
  }, [refresh]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!ready) request.current?.abort();
  }, [ready]);
  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [rows, busy]);

  const send = async (question = input) => {
    question = question.trim();
    if (!question || !ready || !host || !status?.configured || request.current)
      return;
    const lifecycle = new AbortController();
    request.current = lifecycle;
    setBusy(true);
    setInput('');
    const id = crypto.randomUUID();
    setRows((current) =>
      [...current, { id, question, actions: [] }].slice(-12),
    );
    const updateRow = (update: (row: ChatRow) => ChatRow) =>
      setRows((current) =>
        current.map((row) => (row.id === id ? update(row) : row)),
      );
    try {
      const turn = await runCampusAssistantTurn({
        question,
        previous: history.current,
        host,
        signal: lifecycle.signal,
        complete: async (messages, signal): Promise<AssistantMessage> => {
          const response = await fetch('/api/campus-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({ messages, context: getContext() }),
          });
          const result = await response.json();
          if (!isRecord(result))
            throw new Error('模型返回格式不正确，请重试。');
          if (!response.ok)
            throw new Error(
              typeof result.error === 'string'
                ? result.error
                : '模型请求失败，请重试。',
            );
          if (!isRecord(result.message) || result.message.role !== 'assistant')
            throw new Error('模型返回格式不正确，请重试。');
          return result.message as AssistantMessage;
        },
        onAction: (result) =>
          updateRow((row) => ({ ...row, actions: [...row.actions, result] })),
      });
      lifecycle.signal.throwIfAborted();
      history.current = [...history.current, turn].slice(-6);
      updateRow((row) => ({ ...row, reply: turn.reply }));
      return turn.reply;
    } catch (error) {
      updateRow((row) => ({
        ...row,
        error: lifecycle.signal.aborted
          ? '已停止本次提问；已完成的地图操作会保留。'
          : error instanceof Error
            ? error.message
            : '暂时无法完成提问，请重试。',
      }));
    } finally {
      if (request.current === lifecycle) {
        request.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <section
      className={`campus-assistant ${voiceMode ? 'voice-mode' : ''}`}
      aria-label={t('校园 AI 助手')}
    >
      <div className="assistant-heading">
        <span>
          <MessageCircle size={22} />
        </span>
        <div>
          <h2>{t('问校园')}</h2>
          <p>{t('找建筑，问路线。')}</p>
        </div>
      </div>
      <div
        className={`assistant-model-status ${status?.configured ? 'configured' : ''}`}
      >
        <i aria-hidden="true" />
        <span>
          {t(
            status
              ? status.configured
                ? status.model
                : '模型待配置'
              : '正在读取配置…',
          )}
        </span>
        <button
          type="button"
          title={t('重新检查模型配置')}
          aria-label={t('重新检查模型配置')}
          onClick={() => setRefresh((value) => value + 1)}
          disabled={busy}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {status && !status.configured && (
        <p className="assistant-setup-note">
          {t(
            status.error ||
              '配置本地 API Key 后即可提问。地图选点和路线导航仍可直接使用。',
          )}
        </p>
      )}
      <div
        className="assistant-transcript"
        hidden={voiceMode && !rows.length && !busy}
        ref={transcript}
        role="log"
        aria-live="polite"
        aria-label={t('校园对话')}
      >
        {!rows.length && !voiceMode && (
          <div className="assistant-examples">
            <p>{t('可以这样问')}</p>
            {examples.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => {
                  if (status?.configured && ready) void send(t(question));
                  else setInput(t(question));
                }}
              >
                {t(question)}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        )}
        <MessageGroup>
          {rows.map((row) => (
            <div className="assistant-turn" key={row.id}>
              <Message align="end">
                <MessageContent>
                  <p className="assistant-bubble user">{row.question}</p>
                </MessageContent>
              </Message>
              {!!row.actions.length && (
                <ul
                  className="assistant-actions"
                  aria-label={t('地图操作结果')}
                >
                  {row.actions.map((action, index) => (
                    <li
                      key={`${row.id}-${index}`}
                      className={action.ok ? 'success' : 'failed'}
                    >
                      {action.ok ? (
                        <Check size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                      <span>{t(action.message)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {row.reply && (
                <Message>
                  <MessageContent>
                    <AssistantMarkdown content={row.reply} />
                  </MessageContent>
                </Message>
              )}
              {row.error && (
                <p className="assistant-request-error" role="alert">
                  {t(row.error)}
                </p>
              )}
            </div>
          ))}
        </MessageGroup>
        {busy && (
          <output className="assistant-working">
            <LoaderCircle size={15} className="spin" />
            {t('正在完成查询…')}
          </output>
        )}
      </div>
      <div
        className="assistant-input-modes"
        role="group"
        aria-label={t('对话方式')}
      >
        <button
          type="button"
          aria-pressed={!voiceMode}
          onClick={() => setVoiceMode(false)}
        >
          {t('文字输入')}
        </button>
        <button
          type="button"
          aria-pressed={voiceMode}
          onClick={() => setVoiceMode(true)}
        >
          {t('语音对话')}
        </button>
      </div>
      <CampusVoiceControls
        active={active && voiceMode}
        ready={ready && !!status?.configured}
        busy={busy}
        onTranscript={send}
        onCancel={() => request.current?.abort()}
      />
      {!voiceMode && (
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="campus-question">
            {t('向校园助手提问')}
          </label>
          <Textarea
            id="campus-question"
            rows={3}
            maxLength={1000}
            value={input}
            disabled={busy}
            placeholder={t('例如：我在日晷，去图书馆怎么走？')}
            onChange={(event) => setInput(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              requestAnimationFrame(() => {
                composing.current = false;
              });
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                !composing.current
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="assistant-composer-actions">
            <button
              type="button"
              className="assistant-clear"
              aria-label={t('清空对话')}
              title={t('清空对话')}
              disabled={busy || !rows.length}
              onClick={() => {
                history.current = [];
                setRows([]);
              }}
            >
              <Trash2 size={15} />
            </button>
            <span>{t(busy ? '可随时停止' : 'Enter 发送')}</span>
            {busy ? (
              <button
                className="assistant-send"
                type="button"
                onClick={() => request.current?.abort()}
              >
                <Square size={13} />
                {t('停止')}
              </button>
            ) : (
              <button
                className="assistant-send"
                type="submit"
                disabled={!input.trim() || !ready || !status?.configured}
              >
                <Send size={14} />
                {t('发送')}
              </button>
            )}
          </div>
        </form>
      )}
      <p className="assistant-footnote">
        {t('助手会根据校园模型操作地图。入口和路线为估算，以现场指引为准。')}
      </p>
    </section>
  );
}
