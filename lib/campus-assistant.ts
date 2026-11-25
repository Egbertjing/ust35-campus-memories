import {
  executeCampusTool,
  type CampusToolCall,
  type CampusToolHost,
  type CampusToolResult,
} from './campus-tools';

export type ChatWireMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: CampusToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };
export type AssistantMessage = Extract<ChatWireMessage, { role: 'assistant' }>;
export type AssistantSceneContext = {
  language?: 'zh' | 'en';
  focused_place_id: string | null;
  route_start_id: string | null;
  route_end_id: string | null;
};
export type AssistantTurn = {
  messages: ChatWireMessage[];
  reply: string;
  actions: CampusToolResult[];
};

export function recentConversation(turns: AssistantTurn[]): ChatWireMessage[] {
  const selected: AssistantTurn[] = [];
  let count = 0,
    size = 0;
  for (const turn of [...turns].reverse()) {
    const bytes = JSON.stringify(turn.messages).length;
    if (
      selected.length >= 6 ||
      count + turn.messages.length > 38 ||
      size + bytes > 24000
    )
      break;
    selected.unshift(turn);
    count += turn.messages.length;
    size += bytes;
  }
  return selected.flatMap((turn) => turn.messages);
}

export async function runCampusAssistantTurn(options: {
  question: string;
  previous: AssistantTurn[];
  host: CampusToolHost;
  signal: AbortSignal;
  complete: (
    messages: ChatWireMessage[],
    signal: AbortSignal,
  ) => Promise<AssistantMessage>;
  onAction: (result: CampusToolResult) => void;
}): Promise<AssistantTurn> {
  const question = options.question.trim();
  if (!question || question.length > 1000)
    throw new Error('请输入 1–1000 字的问题。');
  const history = recentConversation(options.previous);
  const messages: ChatWireMessage[] = [{ role: 'user', content: question }];
  const actions: CampusToolResult[] = [];
  let count = 0;
  for (let round = 0; round < 6; round++) {
    options.signal.throwIfAborted();
    const response = await options.complete(
      [...history, ...messages],
      options.signal,
    );
    options.signal.throwIfAborted();
    messages.push(response);
    if (!response.tool_calls?.length) {
      if (!response.content?.trim())
        throw new Error('模型没有返回有效回答，请重试。');
      return { messages, actions, reply: response.content.trim() };
    }
    for (const call of response.tool_calls) {
      options.signal.throwIfAborted();
      if (++count > 10)
        throw new Error('本次操作步骤过多，请将问题拆成更具体的一步。');
      let result: CampusToolResult;
      try {
        const input: unknown = JSON.parse(call.function.arguments);
        result = executeCampusTool(options.host, call.function.name, input);
      } catch {
        result = {
          ok: false,
          action: call.function.name,
          message: '参数不是有效的 JSON，请按工具格式重试。',
        };
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
      actions.push(result);
      options.onAction(result);
    }
  }
  throw new Error('模型未能完成这次查询，请提供更明确的建筑名或起终点。');
}
