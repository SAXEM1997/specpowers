#!/usr/bin/env node
// specpowers token 校验 hook（PreToolUse，仅写 .superpowers/.gate-passed-* 时触发）
// state.json 缺失（微小模式）→ fail-open + 警告（与设计文档决策 3 微小仍写 .gate-passed-3 一致）
// state.json 存在 → 校验 name 绑定（token 内容必须含 name=<state.name>）
// stdout JSON: {"decision": "approve"|"block", "reason": "..."}
import { existsSync, readFileSync } from 'node:fs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const toolInput = event.tool_input || {};
    const filePath = event.file_path || toolInput.file_path || '';
    if (!String(filePath).includes('.superpowers/.gate-passed-')) {
      // 注：子串匹配可能误触发（如 evil/.superpowers/.gate-passed-0），但 guard 为最终裁判，hook 为 best-effort
      console.log(JSON.stringify({ decision: 'approve', reason: '非 gate token 写入' }));
      process.exit(0);
    }
    if (!existsSync('.superpowers/state.json')) {
      console.log(JSON.stringify({ decision: 'approve', warning: 'state.json 缺失（微小模式），跳过 name 校验' }));
      process.exit(0);
    }
    const state = JSON.parse(readFileSync('.superpowers/state.json', 'utf8'));
    const content = String(toolInput.content || '');
    const name = state.name;
    if (name && content && !content.includes(`name=${name}`)) {
      console.log(JSON.stringify({ decision: 'block', reason: `gate token name 不匹配 state.name=${name}` }));
      process.exit(2);
      // 注：decision=block 即阻断契约；退出码 2 仅供脚本诊断，PreToolUse 以 decision 字段为准
    }
    console.log(JSON.stringify({ decision: 'approve' }));
  } catch (e) {
    // fail-open：hook 自身异常不阻断写入
    console.log(JSON.stringify({ decision: 'approve', warning: `hook 异常，fail-open: ${e.message}` }));
    process.exit(0);
  }
});
