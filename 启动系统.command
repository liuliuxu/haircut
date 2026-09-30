#!/bin/bash
# ============================================================
#  简悦理发店管理系统 —— Mac 一键启动（双击本文件）
#  - 自动检查 Node.js
#  - 首次运行自动安装后端依赖
#  - 启动后自动打开浏览器 http://localhost:5181
#  - 关闭系统：关掉本窗口，或按 Ctrl+C
# ============================================================
cd "$(dirname "$0")"

echo "============================================================"
echo "  简悦理发店管理系统"
echo "  项目目录: $(pwd)"
echo "============================================================"
echo

# ---- 检查 Node.js ----
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js。"
  echo "请先安装 Node.js 20 LTS（长期支持版）：https://nodejs.org"
  echo "安装完成后重新双击本文件。"
  echo
  read -n1 -r -p "按任意键关闭..."
  exit 1
fi
echo "Node.js 版本: $(node -v)"

# ---- 首次运行：安装依赖（需联网）----
if [ ! -d "server/node_modules" ]; then
  echo
  echo "首次运行，正在安装依赖，请稍候（只需一次）..."
  (cd server && npm install)
  if [ $? -ne 0 ]; then
    echo
    echo "[错误] 依赖安装失败，请检查网络后重试。"
    read -n1 -r -p "按任意键关闭..."
    exit 1
  fi
  echo "依赖安装完成。"
fi

# ---- 2 秒后自动打开浏览器 ----
(sleep 2; open "http://localhost:5181") &

echo
echo "服务启动中，浏览器将自动打开 http://localhost:5181"
echo "登录账号: admin / admin123"
echo "关闭系统：直接关掉本窗口"
echo

cd server
node src/index.js

echo
echo "服务已停止。"
read -n1 -r -p "按任意键关闭..."
