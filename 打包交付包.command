#!/bin/bash
# ============================================================
#  简悦 —— Mac 一键打包（双击本文件）
#  在桌面生成「简悦理发店管理系统_日期.zip」，
#  对方解压后双击「启动系统.bat / .command」即可运行。
# ============================================================
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装 Node.js 20 LTS：https://nodejs.org"
  read -n1 -r -p "按任意键关闭..."
  exit 1
fi

node scripts/build-package.mjs
echo
read -n1 -r -p "按任意键关闭本窗口..."
