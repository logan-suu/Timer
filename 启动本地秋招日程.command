#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "请先安装 Node.js 22 或更新版本。"
  read -r "?按回车关闭…"
  exit 1
fi
tool_port="${PORT:-5173}"
tool_url="http://127.0.0.1:$tool_port"
if node scripts/service-control.mjs status; then
  open "$tool_url"
  exit 0
else
  result=$?
  if [[ "$result" -ne 1 ]]; then
    read -r "?按回车关闭窗口…"
    exit "$result"
  fi
fi
if [[ ! -d node_modules ]]; then npm install; fi
if [[ ! -f dist/index.html ]]; then npm run build; fi
echo "正在启动秋招日程；在此窗口按 Control + C，或双击「关闭秋招日程.command」，即可停止。"
echo "关闭后，保存的数据会保留。"
(sleep 2; open "$tool_url") &
exec node server/index.mjs
