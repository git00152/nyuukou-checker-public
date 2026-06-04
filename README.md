# 入稿データチェッカー

Adobe Illustrator 用の入稿データ品質チェック CEP パネル。
テキストアウトライン忘れ・解像度不足・塗り足し不足などを自動検出し、プレビュー上のオーバーレイと検出結果リストで確認できます。

このリポジトリは個人制作物です。所属組織とは関係なく、所属組織による承認・保守・保証を意味しません。
This project is a personal project and is not affiliated with, endorsed by, or maintained by my employer.

現在のバージョン: v1.0.6

## 動作環境

| 項目 | 要件 |
|------|------|
| Adobe Illustrator | 設定上: 25.3 以上。配布前に利用環境のバージョンで実機確認が必要 |
| OS | macOS |
| CEP バージョン | 11.0+ |
| TAC 確認 | Adobe Acrobat Pro 推奨 |

## インストール方法

v1.0.1 以降、この拡張は署名済み ZXP 配布を前提とします。
未署名の `extension/` フォルダを直接コピーする方式は、開発用または緊急回避用です。

### 通常のインストール

1. Adobe Illustrator を完全終了します
2. ZXP Installer を起動します
3. `nyuukou-checker-v1.0.6.zxp` を ZXP Installer にドラッグ&ドロップします
4. パスワード入力や許可を求められた場合は、macOS の画面表示に従って続行します
5. インストール完了後、Adobe Illustrator を起動します
6. **ウィンドウ → エクステンション → 入稿データチェッカー** を開きます

### ZXP Installer をまだ入れていない場合

1. ブラウザで <https://aescripts.com/learn/zxp-installer/> を開きます
2. macOS 版の ZXP Installer をダウンロードします
3. ダウンロードした `.dmg` を開き、ZXP Installer を Applications フォルダへ入れます
4. ZXP Installer を起動します
5. 起動時に macOS の確認が出た場合は、右クリックから「開く」を選んで起動します
6. ZXP Installer の画面へ `nyuukou-checker-v1.0.6.zxp` をドラッグ&ドロップします

配布先へ GUI で案内する場合は ZXP Installer を使います。
管理者や手順書で一括導入する場合は ExManCmd など、組織で採用する ZXP 導入手段を使います。

### 配布されるファイル

```text
nyuukou-checker-v1.0.6.zxp
```

### アンインストール

ZXP Installer のアンインストール機能を使って削除してください。
手動で削除する場合は、以下のフォルダを削除してください。

```text
~/Library/Application Support/Adobe/CEP/extensions/com.git00152.nyuukochecker
```

### 開発用インストール

`install-dev.command` による直接コピー方式は、開発用・緊急回避用です。
通常配布では使用しないでください。未署名 CEP 拡張の読み込みには配布先環境の設定が影響します。

## 使い方

1. チェックしたい Illustrator ファイルを開きます
2. パネルの「チェック実行」ボタンをクリックします
3. 結果が ERROR / WARNING / INFO の 3 段階で表示されます
4. 重要度ボタンとフィルタ詳細で表示する結果を絞り込めます
5. プレビューの拡大縮小、100% 表示、全体表示、選択項目への移動ができます
6. 検出結果グループを展開し、項目をクリックするとプレビュー上の該当箇所がハイライトされます
7. 設定パネルで検出対象や表示・操作設定を切り替えられます

### 大判印刷モード

大判印刷用ファイルの場合は、設定パネル内の「大判印刷モード」を有効にしてからチェックを実行してください。
画像解像度の判定が大判印刷向けに緩和され、200dpi 以上 300dpi 未満は INFO として扱われます。

### 設定パネル

設定パネルでは、オープンパス検出、塗りありオープンパス検出、ガイドやトンボレイヤーを検出対象に含めるかどうか、結果選択時のプレビュー自動移動、削除前確認を切り替えられます。
設定変更は次回の「チェック実行」から反映されます。

### 対象選択と安全削除

一部の検出結果では、カード内の「編集画面で選択」から Illustrator 上の対象を選択できます。
削除アクションは安全のため、孤立点と未使用スウォッチに限定しています。削除直前にも対象を再特定・再判定し、対象が見つからない、複数候補が残る、使用中スウォッチである、ロック中である場合は削除しません。

### Acrobat での TAC 確認

「AcrobatでTAC確認」ボタンを押すと、現在の AI ファイルを保存したうえで Acrobat 確認用 PDF を一時保存し、Adobe Acrobat で開きます。Adobe Acrobat を開けない場合は Adobe Acrobat Reader も試します。

この機能は、拡張機能内で総インキ使用量を完全判定するものではありません。画像や重なりを含む TAC は、Acrobat Pro の出力プレビューで確認してください。

一時保存された PDF が不要になった場合は、「一時PDFを削除」ボタンで削除できます。

## チェック項目一覧

| カテゴリ | 項目 | 重要度 |
|----------|------|--------|
| テキスト | アウトライン化されていないライブテキスト | ERROR |
| パス | 空パス（塗りなし・線なし） | WARNING |
| パス | 孤立点 | WARNING |
| パス | 細線（0.28pt 未満） | WARNING |
| パス | オープンパス | WARNING |
| パス | 塗りありオープンパス | WARNING |
| パス | テキストオーバーフロー | ERROR |
| レイヤー | 非表示レイヤー | WARNING |
| レイヤー | 非表示オブジェクト | WARNING |
| 画像 | 解像度不足（300dpi 未満） | ERROR |
| 画像 | 解像度注意（300dpi 以上 350dpi 未満） | WARNING |
| 画像 | 大判印刷モード時の解像度注意（200dpi 以上 300dpi 未満） | INFO |
| 画像 | 解像度取得不可 | INFO |
| 画像 | リンク切れ | ERROR |
| 画像 | CMYK / グレースケール / モノクロ以外の配置画像 | ERROR |
| 画像 | カラーモード自動判定不可 | INFO |
| 画像 | ラスタライズ効果の解像度不足 | WARNING |
| カラー | ドキュメントカラーモード（RGB 等） | ERROR |
| カラー | CMYK 合計値 350% 超過（パスの塗り・線） | WARNING |
| カラー | CMYK 小数点値 | INFO |
| カラー | 意図しないオーバープリント | WARNING |
| カラー | 白オブジェクトのオーバープリント | WARNING |
| カラー | 未使用スウォッチ | INFO |
| カラー | スポットカラー使用 | WARNING |
| 塗り足し | 塗り足し不足（3mm 未到達） | WARNING |
| 塗り足し | セーフゾーン違反 | WARNING |

## 配布作成者・管理者向け情報

### 配布方針

通常配布では、署名済み ZXP のみを配布します。
正式配布では、コード署名用途の証明書または組織で管理する配布用証明書を使用してください。
自己署名証明書は身内検証用です。

配布先への案内は、対象者に応じて分けます。

- GUI で案内する場合は ZXP Installer を使います
- 管理者や手順書で一括導入する場合は ExManCmd など、組織で採用するコマンドライン導入手段を使います
- どちらの場合も Illustrator を完全終了してからインストールし、インストール後に Illustrator を起動します
- インストール後は **ウィンドウ → エクステンション → 入稿データチェッカー** を開きます

### 配布版ビルド

```bash
SKIP_DOTENV=true npm run build
npm run verify:cep
```

### 正式証明書で ZXP を生成

`.env` は使用せず、必要なビルド時シークレットは環境変数として注入してください。
証明書とパスワードはリポジトリに含めないでください。

```bash
export ZXPSIGNCMD_PATH="/path/to/ZXPSignCmd"
export ZXP_CERT_PATH="/path/to/distribution-certificate.p12"
export ZXP_CERT_PASSWORD="証明書のパスワード"
npm run package:zxp
```

出力先:

```text
dist/nyuukou-checker-v1.0.6.zxp
```

### 自己署名証明書で検証する場合

自己署名証明書は身内検証用です。
正式配布では、自己署名証明書ではなく配布用証明書の `.p12` を指定してください。

証明書を作成します。

```bash
export ZXPSIGNCMD_PATH="/path/to/ZXPSignCmd"
export ZXP_CERT_PASSWORD="任意の強いパスワード"
npm run cert:self
```

作成した証明書で ZXP を生成します。

```bash
export ZXPSIGNCMD_PATH="/path/to/ZXPSignCmd"
export ZXP_CERT_PATH="certs/self-signed.p12"
export ZXP_CERT_PASSWORD="証明書のパスワード"
npm run package:zxp
```

### 開発環境セットアップ

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

### 開発用 installer zip

直接コピー型の installer は通常配布ではなく、開発用・緊急回避用です。

```bash
SKIP_DOTENV=true npm run build
npm run installer
```

出力される `install-dev.command` は未署名拡張を CEP extensions 配下へ直接コピーします。
PlayerDebugMode は開発用・緊急回避用として扱い、通常配布手順には含めません。

### トラブルシュート

#### メニューに表示されない

- ZXP が正しくインストールされていない
- Illustrator のバージョンが 25.3 未満
- manifest.xml の Host Version と環境が合っていない

#### パネルが真っ白になる

- `index.html` は開いているが JavaScript 実行時に失敗している
- React のマウントに失敗している
- CEP 上で Node.js / `require` が使えない

#### ログも生成されない

- CEP が `index.html` を実行する前に止まっている
- 未署名拡張が拒否されている
- ZXP が正しくインストールされていない
- Illustrator / CEP バージョンが対象外

### テスト実行

```bash
npm test
```

## ライセンス

MIT
