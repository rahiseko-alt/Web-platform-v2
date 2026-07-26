import type { ComponentType } from 'react';
import type { DesignSpec } from '@/templates/types';
import Header01 from './blocks/header-01';
import Hero01 from './blocks/hero-01';
import Services01 from './blocks/services-01';
import Features01 from './blocks/features-01';
import About01 from './blocks/about-01';
import Stats01 from './blocks/stats-01';
import Process01 from './blocks/process-01';
import Testimonials01 from './blocks/testimonials-01';
import Faq01 from './blocks/faq-01';
import Cta01 from './blocks/cta-01';
import Contact01 from './blocks/contact-01';
import Footer01 from './blocks/footer-01';

/**
 * design は任意（省略可）。テンプレ側にdesignが無い/未対応部品は無視してよい後方互換フィールド。
 * 対応する部品（hero-01等）はdesign?.heroVariant等でtoken->変種を決定的に切り替える。
 */
export type SectionProps = { content: Record<string, unknown>; design?: DesignSpec };

/**
 * セクション種別ID -> Reactコンポーネントの解決レジストリ。
 * フェーズ1でセクション部品を追加する際はここに登録する。
 */
export const sectionRegistry: Record<string, ComponentType<SectionProps>> = {
  'header-01': Header01,
  'hero-01': Hero01,
  'services-01': Services01,
  'features-01': Features01,
  'about-01': About01,
  'stats-01': Stats01,
  'process-01': Process01,
  'testimonials-01': Testimonials01,
  'faq-01': Faq01,
  'cta-01': Cta01,
  'contact-01': Contact01,
  'footer-01': Footer01,
};

export function resolveSection(sectionType: string): ComponentType<SectionProps> | undefined {
  return sectionRegistry[sectionType];
}
