/**
 * OpenAI アダプタ（plan #3）。LlmClient の唯一の実体。
 *
 * SDK（`npm install openai`）ではなく fetch で REST を直叩きする:
 * - AI からの `npm install` は権限拒否される＝追加インストールはマスター手作業の待ちになる
 * - REST なら追加依存ゼロ。要るのは OPENAI_API_KEY（.env にマスターが置く）だけ
 * - SDK の破壊的変更に引きずられる保守リスクも負わない
 *
 * このファイルだけが外部 API を触る。ロジック（generate.ts）は LlmClient 経由なので
 * キー無し・ネットワーク無しでも fake client でテストできる。
 *
 * 空 catch 禁止（§2）: キー欠落・HTTP エラー・空応答はすべて明示エラーで停止する。
 */

import type { LlmClient } from './client';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.7;

export interface OpenAiClientOptions {
  /** 省略時は process.env.OPENAI_API_KEY を読む */
  apiKey?: string;
  /** 省略時は process.env.OPENAI_MODEL ?? 'gpt-4o' */
  model?: string;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function createOpenAiClient(options: OpenAiClientOptions = {}): LlmClient {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY が設定されていません。.env に OPENAI_API_KEY=<キー> を置いてください（AI は .env を読めません）。',
    );
  }
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

  return {
    async complete(systemPrompt: string, userPrompt: string): Promise<string> {
      const res = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`OpenAI API がエラーを返しました (HTTP ${res.status}): ${detail.slice(0, 500)}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI の応答に content が含まれていませんでした');
      }
      return content;
    },
  };
}
