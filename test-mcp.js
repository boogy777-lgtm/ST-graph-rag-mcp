const { spawnSync } = require('child_process');
const res = spawnSync('.\\bin\\st-graph-rag-mcp.exe', [], { input: '{"jsonrpc":"2.0","method":"tools/list","id":1}\n', encoding: 'utf-8' });
console.log(res.stdout);
