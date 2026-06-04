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
  read -p "Enterキーで終了..."
  exit 1
fi

if [ -d "$INSTALL_DIR" ]; then
  echo "既にインストールされています。更新します..."
else
  echo "インストールを開始します..."
fi

mkdir -p "$INSTALL_BASE"

if rm -rf "$INSTALL_DIR" && ditto "$EXT_SOURCE" "$INSTALL_DIR"; then
  echo ""
  echo "✓ 開発用インストールが完了しました。"
  echo ""
  echo "Illustrator を再起動してパネルを有効にしてください。"
else
  echo ""
  echo "✗ インストール中にエラーが発生しました。"
fi

echo ""
read -p "Enterキーで終了..."
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

この zip は開発用・緊急回避用です。
通常配布では署名済み ZXP を使用してください。

【インストール手順】
1. この zip を解凍する（既に解凍済みならスキップ）
2. 「install-dev.command」をダブルクリックする
3. ターミナルが開き、インストールが完了する
4. Illustrator を再起動してパネルを有効にする

【通常配布】
署名済み ZXP:
  dist/nyuukou-checker-v${VERSION}.zxp

【パネルの開き方】
Illustrator メニュー:
  ウィンドウ → エクステンション → 入稿データチェッカー

【初回起動時の注意 (macOS Gatekeeper)】
「開発元を確認できません」と表示された場合:
  ① install.command を右クリック →「開く」を選択
  ② 「開く」をクリックして確認

それでも開けない場合:
  システム設定 → プライバシーとセキュリティ →「とにかく開く」

【アンインストール】
以下のフォルダを削除してください:
  ~/Library/Application Support/Adobe/CEP/extensions/${EXT_ID}
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
