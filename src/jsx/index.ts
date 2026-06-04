// @include './lib/json2.js'

import { ns } from "../shared/shared";
import * as ilst from "./ilst/ilst";
import { runner, RunOptions } from "./hostscript/runner";

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

// ExtendScript JSON 公開 — クロージャー方式:
// json2.js ポリフィルは IIFE 内でローカルに JSON をセットするが、$.global への漏洩が
// 保証されないため、クロージャーで IIFE 内の JSON を参照する関数を $["__serialize"] に格納する。
// evalTS スクリプトからは host["__serialize"](obj) として呼び出す。
//
// 文字化け対策: Illustrator CS6+ は組み込みの JSON.stringify を持つが、
// その実装は日本語などの非 ASCII 文字を \uXXXX にエスケープしない場合があり、
// CEP ブリッジ経由で Shift-JIS として解釈されて文字化けする。
// JSON.stringify の結果に対して非 ASCII 文字を強制的に \uXXXX エスケープする後処理を追加する。
//@ts-ignore
if (typeof $ !== "undefined" && typeof JSON !== "undefined") {
  //@ts-ignore
  ($  as any)["__serialize"] = function(obj: unknown) {
    var s = JSON.stringify(obj);
    // 非ASCII文字 (\u0080以上) を \uXXXX にエスケープ
    // ExtendScript の String.replace + 関数コールバックは ES3 で動作する
    return s.replace(/[\u0080-\uffff]/g, function(c: string) {
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  };
  //@ts-ignore
  ($  as any)["__parse"]     = function(s: string)    { return JSON.parse(s); };
}

host[ns] = ilst;

// evalTS エントリポイント — Bolt CEP の evalTS パターン
// evalTS('runAll', options) でアクティブドキュメントの全チェックを実行する
// options.largePrintMode: true の場合、IMG-03 チェッカーは 200dpi 以上を INFO として報告する
// NOTE: 値エクスポートしない — export { runAll } が ExtendScript IIFE 内に出力され SyntaxError になるため
// host[ns] = ilst 経由でアクセスされるので値エクスポートは不要
const runAll = (options?: RunOptions) => runner.runAll(undefined, options);

const empty = {};
// prettier-ignore
export type Scripts = typeof empty
  & typeof ilst
  & { runAll: typeof runAll }
  ;
