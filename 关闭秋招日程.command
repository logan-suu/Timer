#!/bin/zsh
cd "$(dirname "$0")"
echo "云端版关闭网页即可。下面只停止本机的本地版服务。"
if ! command -v node >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请在原运行窗口按 Control + C 关闭工具。"
  read -r "?按回车关闭窗口…"
  exit 1
fi
node scripts/service-control.mjs stop
result=$?
if [[ "$result" -ne 0 ]]; then
  read -r "?按回车关闭窗口…"
fi
exit "$result"
