/**
 * セクションごとの content 契約（単一正本）。
 *
 * 各スキーマは「レンダラが実際に読むフィールド」だけを持つ。部品が読まないフィールドは
 * 書かない（proto が footer に heading 等を渡していたが footer-01 は columns/copyright しか
 * 読まない、という類の乖離をここで断つ）。
 *
 * 項目数の下限・上限は機械が固定する枠であり、LLM に決めさせない
 * （plan A2「どのセクションに何項目のコピーが要るか」の枠は機械側）。
 * .describe() はプロンプトへ台帳として書き出すために使う（describe.ts）。
 */

import { z } from 'zod';
import { CONTENT_ENUMS } from './vocabulary';

const text = (desc: string) => z.string().min(1).describe(desc);
const href = (desc: string) => z.string().min(1).describe(desc);

/*
 * 画像URLは**契約から外してある**。LLM は実在する画像URLを知り得ないため、
 * 書かせると必ず捏造か "unknown" になる（2026-07-23 実機で確認）。
 * 画像は「値の選択」ではなく「組み立て」の仕事なので機械が入れる（validate.ts の
 * assemblePage が決定的に注入する）。差し替え先を1箇所にまとめる意味もある。
 */

const linkSchema = z.object({
  label: text('リンクの表示文言'),
  href: href('遷移先。ページ内は #services 等のアンカー、別ページは /about 等'),
});

export const sectionContentSchemas = {
  'header-01': z.object({
    logo: text('店舗・事業の表記名'),
    navItems: z.array(linkSchema).min(2).max(5).describe('グローバルナビ 2〜5 項目'),
    ctaLabel: text('ヘッダー右のCTA文言'),
    ctaHref: href('CTAの遷移先'),
    phone: text('電話番号。依頼文に無ければ**この項目ごと省略**し unknowns に出す').optional(),
  }),

  'hero-01': z.object({
    badge: text('見出し上の小さな一言。強みや前提条件を短く'),
    title: text('主見出し。20字前後を目安に、業種と表現が両方伝わる一文'),
    subtitle: text('補足文。依頼文の訴求を落とさず 60〜120 字'),
    ctaLabel: text('主CTAの文言'),
    ctaHref: href('主CTAの遷移先'),
    secondaryLabel: text('副CTAの文言'),
    secondaryHref: href('副CTAの遷移先'),
    anchor: z.enum(CONTENT_ENUMS['hero-01'].anchor).describe('見出しの寄せ位置'),
  }),

  'services-01': z.object({
    heading: text('セクション見出し'),
    intro: text('導入文').optional(),
    items: z
      .array(
        z.object({
          title: text('メニュー・サービス名'),
          price: text('価格表記。例 ¥7,700 / 応相談'),
          description: text('40〜70字の説明'),
        }),
      )
      .min(3)
      .max(6)
      .describe('サービス 3〜6 項目'),
  }),

  'features-01': z.object({
    heading: text('セクション見出し'),
    intro: text('導入文').optional(),
    items: z
      .array(
        z.object({
          title: text('選ばれる理由の見出し'),
          description: text('40〜80字の説明'),
        }),
      )
      .min(3)
      .max(6)
      .describe('特徴 3〜6 項目'),
  }),

  'about-01': z.object({
    heading: text('セクション見出し'),
    body: text('事業者・店舗の紹介文 120〜240 字'),
    credentials: z
      .array(text('肩書き・実績の1行'))
      .max(5)
      .describe('資格・実績。依頼文に根拠が無ければ空配列にし unknowns に出す'),
  }),

  'stats-01': z.object({
    items: z
      .array(
        z.object({
          value: text('数値。例 88% / 300名+'),
          label: text('数値の意味。出所が自社データなら明記する'),
        }),
      )
      .min(2)
      .max(4)
      .describe('数値 2〜4 項目。依頼文に根拠が無ければこのセクション自体を採用しない'),
  }),

  'process-01': z.object({
    heading: text('セクション見出し'),
    steps: z
      .array(
        z.object({
          no: text('連番。01 / 02 形式'),
          title: text('工程名'),
          description: text('40〜80字の説明'),
        }),
      )
      .min(3)
      .max(5)
      .describe('工程 3〜5 項目'),
  }),

  'testimonials-01': z.object({
    heading: text('セクション見出し'),
    mode: z
      .enum(CONTENT_ENUMS['testimonials-01'].mode)
      .describe('quote=証言カード / beforeAfter=施術前後の比較。骨格そのものが変わる'),
    items: z
      .union([
        z
          .array(
            z.object({
              quote: text('お客様の声。40〜80字'),
              author: text('イニシャル表記。例 A.M様'),
              role: text('属性。例 30代 会社員'),
            }),
          )
          .min(2)
          .max(4),
        z
          .array(
            z.object({
              label: text('比較の見出し'),
              caption: text('補足'),
            }),
          )
          .min(2)
          .max(4),
      ])
      .describe('mode に対応する形の配列を 2〜4 項目。mode と形が食い違うと拒否する'),
  }),

  'faq-01': z.object({
    heading: text('セクション見出し'),
    items: z
      .array(
        z.object({
          question: text('想定質問'),
          answer: text('回答 60〜140 字'),
        }),
      )
      .min(3)
      .max(6)
      .describe('Q&A 3〜6 項目'),
  }),

  'cta-01': z.object({
    heading: text('行動を促す見出し'),
    body: text('補足文 40〜90 字'),
    ctaLabel: text('CTA文言'),
    ctaHref: href('CTAの遷移先'),
    phone: text('電話番号。依頼文に無ければ省略する').optional(),
  }),

  'contact-01': z.object({
    heading: text('セクション見出し'),
    email: text('連絡先メール。依頼文に無ければ**この項目ごと省略**し unknowns に出す').optional(),
    phone: text('電話番号。依頼文に無ければ**この項目ごと省略**し unknowns に出す').optional(),
    ctaLabel: text('CTA文言'),
  }),

  'footer-01': z.object({
    columns: z
      .array(
        z.object({
          title: text('カラム見出し'),
          links: z.array(linkSchema).min(2).max(5),
        }),
      )
      .min(1)
      .max(3)
      .describe('フッターのリンク列 1〜3'),
    copyright: text('著作権表記'),
  }),
} as const;

export type SectionContentSchemas = typeof sectionContentSchemas;

export function schemaFor(sectionType: string): z.ZodTypeAny | undefined {
  return (sectionContentSchemas as Record<string, z.ZodTypeAny>)[sectionType];
}
