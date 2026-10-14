import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.env.PORT || 5173);
const action = process.argv[2];
if (!['status', 'stop'].includes(action) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('启动参数不正确。'); process.exit(2);
}
function readProcess() {
  let output;
  try { output = execFileSync('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    if (error.status === 1 && !String(error.stderr || '').trim()) return null;
    throw new Error('暂时无法检查工具是否运行。');
  }
  const pids = [...new Set(output.trim().split(/\s+/).map(Number))];
  if (pids.length !== 1 || !Number.isInteger(pids[0]) || pids[0] < 1) throw new Error(`端口 ${port} 被其他程序占用，未停止任何程序。`);
  const pid = pids[0];
  let cwd, command;
  try {
    const details = execFileSync('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    cwd = details.split('\n').find(line => line.startsWith('n'))?.slice(1);
    command = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { throw new Error('无法确认运行中的工具，请在原运行窗口按 Control + C 关闭。'); }
  // Validate both project directory and server command before sending a signal.
  if (!cwd || realpathSync(cwd) !== root || !/(?:^|[ /])server\/index\.mjs(?:\s|$)/.test(command) || !/(?:^|[ /])node(?:\s|$)/.test(command)) {
    throw new Error(`端口 ${port} 被其他程序占用，未停止任何程序。`);
  }
  return pid;
}
try {
  const pid = readProcess();
  if (action === 'status') {
    if (pid) console.log('秋招日程已在运行，正在打开页面。');
    process.exit(pid ? 0 : 1);
  }
  if (!pid) { console.log('秋招日程已经关闭，保存的数据会保留。'); process.exit(0); }
  process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt++) {
    try { process.kill(pid, 0); }
    catch (error) {
      if (error.code === 'ESRCH') { console.log('秋招日程已关闭，保存的数据会保留。'); process.exit(0); }
      throw error;
    }
    await setTimeout(200);
  }
  console.error('工具仍在完成当前请求，请稍后再次双击关闭。'); process.exitCode = 2;
} catch (error) { console.error(error.message); process.exitCode = 2; }
