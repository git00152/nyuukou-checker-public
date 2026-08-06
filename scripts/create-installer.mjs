// scripts/create-installer.mjs
// macOS インストーラー (.command + zip) ビルドスクリプト
// 使い方: npm run installer (dist/cep/ が存在する状態で実行)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST_CEP = path.join(ROOT, "dist/cep");
const DIST_INSTALLER = path.join(ROOT, "dist/installer");
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = PACKAGE_JSON.version;
const INSTALLER_DIR_NAME = `入稿データチェッカー-v${VERSION}-installer`;
const INSTALLER_DIR = path.join(DIST_INSTALLER, INSTALLER_DIR_NAME);
const COMMAND_NAME = "install-dev.command";
const EXT_ID = "com.git00152.nyuukochecker";

function prepare() {
  if (!fs.existsSync(DIST_CEP)) {
    console.error("❌  dist/cep/ が見つかりません。先に npm run build を実行してください。");
    process.exit(1);
  }
  // dist/installer/ を丸ごと削除して再作成（古いファイルの混在防止）
  if (fs.existsSync(DIST_INSTALLER)) {
    fs.rmSync(DIST_INSTALLER, { recursive: true, force: true });
  }
  fs.mkdirSync(INSTALLER_DIR, { recursive: true });
}

function buildCommandScript() {
  const script = `#!/bin/bash
# 入稿データチェッカー v${VERSION} 開発用インストーラー

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_SOURCE="$SCRIPT_DIR/extension"
EXT_ID="${EXT_ID}"
INSTALL_BASE="$HOME/Library/Application Support/Adobe/CEP/extensions"
INSTALL_DIR="$INSTALL_BASE/$EXT_ID"
STAGING_DIR="$INSTALL_BASE/.$EXT_ID.new-$$"
BACKUP_DIR=""
BACKUP_CREATED=0

echo "=========================================="
echo " 入稿データチェッカー v${VERSION} 開発用インストーラー"
echo "=========================================="
echo ""
echo "⚠ このインストーラーは開発用です。"
echo "通常配布では署名済み ZXP を使用してください。"
echo ""

if [ ! -d "$EXT_SOURCE" ]; then
  echo "✗ extension フォルダが見つかりません。"
  echo "  zip を解凍した後、フォルダごと移動せずに実行してください。"
  echo ""
  read -r -p "Enterキーで終了..."
  exit 1
fi

if [ -e "$STAGING_DIR" ]; then
  echo "✗ 前回の一時ディレクトリが残っています: $STAGING_DIR"
  echo "  内容を確認してから手動で削除し、再度実行してください。"
  echo ""
  read -r -p "Enterキーで終了..."
  exit 1
fi

if [ -d "$INSTALL_DIR" ]; then
  echo "既存の開発用拡張をバックアップして置き換えます。"
  read -r -p "続行しますか？ [y/N] " reply
  if [ "$reply" != "y" ] && [ "$reply" != "Y" ]; then
    echo "中止しました。"
    exit 0
  fi
fi

mkdir -p "$INSTALL_BASE"

if ! ditto "$EXT_SOURCE" "$STAGING_DIR"; then
  echo ""
  echo "✗ 新しい拡張ファイルの準備に失敗しました。既存の拡張は変更していません。"
  echo ""
  read -r -p "Enterキーで終了..."
  exit 1
fi

if [ -d "$INSTALL_DIR" ]; then
  BACKUP_DIR="$INSTALL_DIR.backup-$(date +%Y%m%d%H%M%S)"
  if ! mv "$INSTALL_DIR" "$BACKUP_DIR"; then
    echo ""
    echo "✗ 既存の拡張をバックアップできませんでした。既存の拡張は変更していません。"
    echo "  準備済みファイル: $STAGING_DIR"
    echo ""
    read -r -p "Enterキーで終了..."
    exit 1
  fi
  BACKUP_CREATED=1
  echo "✓ 既存の拡張をバックアップしました: $BACKUP_DIR"
fi

if mv "$STAGING_DIR" "$INSTALL_DIR"; then
  echo ""
  echo "✓ 開発用インストールが完了しました。"
  if [ "$BACKUP_CREATED" = "1" ]; then
    echo "  以前の拡張は次の場所に保管されています: $BACKUP_DIR"
  fi
  echo ""
  echo "Illustrator を再起動してパネルを有効にしてください。"
else
  echo ""
  echo "✗ 新しい拡張を配置できませんでした。"
  if [ "$BACKUP_CREATED" = "1" ]; then
    if mv "$BACKUP_DIR" "$INSTALL_DIR"; then
      echo "✓ 以前の拡張を復元しました。"
    else
      echo "✗ 自動復元に失敗しました。バックアップ: $BACKUP_DIR"
    fi
  fi
fi

echo ""
read -r -p "Enterキーで終了..."
`;

  const commandPath = path.join(INSTALLER_DIR, COMMAND_NAME);
  fs.writeFileSync(commandPath, script, "utf8");
  fs.chmodSync(commandPath, 0o755);
}

function embedExtension() {
  const dest = path.join(INSTALLER_DIR, "extension");
  copyDir(DIST_CEP, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkipDistributionFile(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(from), to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function shouldSkipDistributionFile(name) {
  return name === ".DS_Store" || name === ".debug" || name.endsWith(".map");
}

function writeReadme() {
  const readme = `入稿データチェッカー 開発用インストーラー
====================================

バージョン: v${VERSION}

この zip は開発・検証用途に限ります。
通常の利用・配布では、GitHub Releases の署名済み ZXP を使用してください。

【インストール手順】
1. この zip を解凍する（既に解凍済みならスキップ）
2. 配布元とファイル内容を確認する
3. 「install-dev.command」を実行する
4. 既存の開発用拡張がある場合は、確認に応じてバックアップを作成する
5. Illustrator を再起動してパネルを有効にする

【macOS のセキュリティ警告が出た場合】
macOS のセキュリティ機能を無効化しないでください。
配布元とファイルの正当性を確認できない場合は実行を中止し、通常配布の署名済み ZXP を使用してください。

【通常配布】
署名済み ZXP:
  dist/nyuukou-checker-v${VERSION}.zxp

【パネルの開き方】
Illustrator メニュー:
  ウィンドウ → エクステンション → 入稿データチェッカー

【アンインストール】
以下のフォルダを削除してください:
  ~/Library/Application Support/Adobe/CEP/extensions/${EXT_ID}

【バックアップの扱い】
既存の開発用拡張は、更新前に次の形式で同じフォルダ内へ退避します:
  ${EXT_ID}.backup-YYYYMMDDHHMMSS
動作確認後、不要なバックアップは内容を確認したうえで手動で削除してください。
`;
  fs.writeFileSync(path.join(INSTALLER_DIR, "README.txt"), readme, "utf8");
}

function createZip() {
  const zipName = `${INSTALLER_DIR_NAME}.zip`;
  const zipPath = path.join(DIST_INSTALLER, zipName);
  // ditto で実行権限を保持しつつ、macOS メタデータは配布物へ含めない。
  execSync(
    `ditto -c -k --norsrc --keepParent ${JSON.stringify(INSTALLER_DIR)} ${JSON.stringify(zipPath)}`,
    { stdio: "pipe" }
  );
}

function validateBundle() {
  const required = [
    path.join(INSTALLER_DIR, COMMAND_NAME),
    path.join(INSTALLER_DIR, "extension/CSXS/manifest.xml"),
    path.join(INSTALLER_DIR, "README.txt"),
    path.join(DIST_INSTALLER, `${INSTALLER_DIR_NAME}.zip`),
  ];
  for (const p of required) {
    if (!fs.existsSync(p)) {
      throw new Error(`必須ファイルが見つかりません: ${p}`);
    }
  }
}

async function main() {
  console.log("🔨 インストーラーを生成中...");
  prepare();
  console.log("  ✓ 出力ディレクトリを初期化");
  buildCommandScript();
  console.log("  ✓ install-dev.command を生成");
  embedExtension();
  console.log("  ✓ 拡張ファイルを組み込み");
  writeReadme();
  console.log("  ✓ README.txt を生成");
  createZip();
  console.log("  ✓ 配布用 zip を生成");
  validateBundle();
  console.log(`\n✅ 完了: dist/installer/${INSTALLER_DIR_NAME}.zip`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
