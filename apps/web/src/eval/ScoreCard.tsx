/**
 * 機械採点（A〜E・50点満点）の画面表示（ロードマップ B-3-a / B-3-b）。
 *
 * 採点そのものはここで行わない（scorePage を呼ぶのは呼び出し側の仕事）。ここは
 * PageScore を画面へ写すだけ。
 *
 * data 属性は E2E / 独立検証が「何点だったか」「なぜ引かれたか」を文言に依存せず
 * 掴むための安定マーカー。B-3-a の受入は画面の値と、別プロセスでの再計算結果を
 * 突き合わせる形で行うため、ここで出す数値・理由の文字列がそのまま比較対象になる。
 */

import type { PageScore } from './score';
import type { ScoreKey } from './rubric';

/** rubric.ts の WEIGHTS と同じ並び。画面表示の順序をここで固定する */
const ORDER: readonly ScoreKey[] = ['brief', 'length', 'structure', 'honesty', 'variety'] as const;

export function ScoreCard({ score }: { score: PageScore }) {
  return (
    <div
      data-eval="machine-score"
      data-eval-total={score.total}
      data-eval-max={score.max}
      className="mx-auto mt-4 max-w-3xl border border-border px-6 py-4 text-sm"
    >
      <p className="font-medium text-text">
        機械採点 <span data-eval-total-text>{score.total}</span> / {score.max}
      </p>
      <ul className="mt-2 space-y-2">
        {ORDER.map((key) => {
          const detail = score.details[key];
          return (
            <li
              key={key}
              data-eval-item={key}
              data-eval-item-score={detail.score}
              data-eval-item-max={detail.max}
            >
              <p>
                {detail.label}: {detail.score} / {detail.max}
              </p>
              {/*
                notes は満点の項目にも付くことがある（「測定対象なし」等）。常に全件出す
                （満点未満だけに絞ると、絞り込みロジックが notes を取りこぼす経路が増える）。
                B-3-b の受入は「満点でない項目に理由が漏れなく出る」ことなので、これは
                その要求の上位互換になる。
              */}
              {detail.notes.length > 0 && (
                <ul data-eval-item-notes className="ml-4 list-disc text-xs text-text-muted">
                  {detail.notes.map((note, index) => (
                    <li key={index} data-eval-note>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
