import type { DesignSpec, TemplateDefinition } from './types';
import generalTemplate001 from './definitions/general-001';
import generalTemplate002 from './definitions/general-002';

/**
 * templateId -> TemplateDefinition の解決レジストリ。
 * DB(sites.templateId)から構造化トークン(DesignSpec)を引くための単一の参照点。
 * 新規テンプレを追加する際はここに登録する（definitions配下を増やすだけでは効かない）。
 */
export const templateDefinitions: Record<string, TemplateDefinition> = {
  [generalTemplate001.templateId]: generalTemplate001,
  [generalTemplate002.templateId]: generalTemplate002,
};

/**
 * 未登録templateId・design未設定テンプレ向けの既定トークン（後方互換フォールバック）。
 * hero-01等の部品側は design が undefined でも split-editorial 相当へ独自にフォールバックするため、
 * この定数は「テンプレ側の design を明示的に持たせたい」呼び出し元向けに用意する。
 */
export const DEFAULT_DESIGN_SPEC: DesignSpec = {
  heroVariant: 'split-editorial',
  rhythm: 'normal',
  align: 'asymmetric',
};

export function getTemplateDefinition(templateId: string): TemplateDefinition | undefined {
  return templateDefinitions[templateId];
}

export function getDesignSpec(templateId: string): DesignSpec | undefined {
  return templateDefinitions[templateId]?.design;
}
