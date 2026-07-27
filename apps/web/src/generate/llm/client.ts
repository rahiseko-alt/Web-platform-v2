/**
 * LLM 呼び出しの抽象境界（plan #1・B図の「LLM判断」）。
 *
 * 稼働ループ（generate.ts）はこのインターフェース経由でしか LLM を触らない。
 * これにより:
 * - 実体（OpenAI / fake）を差し替えられる
 * - API キー無しでも fake client でループの全ロジックをテストできる
 *   （決定的アサーション・docs/design-notes.md §6-2）
 *
 * 契約: system/user の2文字列を受け取り、モデルの生の応答文字列を返すだけ。
 * JSON への parse も検証も呼び出し側（generate.ts）が行う。
 */
export interface LlmClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
