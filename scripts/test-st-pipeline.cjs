const { spawn } = require('child_process');
const { readFileSync, readdirSync } = require('fs');
const path = require('path');

const TRUST_LSP = path.join(__dirname, '..', 'trust-platform', 'target', 'release', 'trust-lsp.exe');
const WORKSPACE_DIR = path.join(__dirname, '..', 'test-trust-workspace');

console.log('=== ST LSP Pipeline Quick Test ===\n');

// === LSP Client ===
const lsp = spawn(TRUST_LSP, ['--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = Buffer.alloc(0);
let messageId = 0;
let pending = new Map();

lsp.stdout.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  while (true) {
    const match = buffer.toString().match(/^Content-Length: (\d+)\r\n\r\n/);
    if (!match) break;
    const len = parseInt(match[1]);
    const headerEnd = match[0].length;
    if (buffer.length < headerEnd + len) break;
    const content = buffer.subarray(headerEnd, headerEnd + len);
    buffer = buffer.subarray(headerEnd + len);
    try {
      const resp = JSON.parse(content.toString('utf8'));
      if (resp.id && pending.has(resp.id)) {
        const { resolve, reject } = pending.get(resp.id);
        pending.delete(resp.id);
        if (resp.error) reject(new Error(resp.error.message));
        else resolve(resp.result);
      }
    } catch (e) { /* ignore */ }
  }
});

function req(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    const msg = { jsonrpc: '2.0', id, method, params };
    const content = JSON.stringify(msg);
    lsp.stdin.write('Content-Length: ' + Buffer.byteLength(content, 'utf8') + '\r\n\r\n' + content);
  });
}

function notify(method, params) {
  const msg = { jsonrpc: '2.0', method, params };
  const content = JSON.stringify(msg);
  lsp.stdin.write('Content-Length: ' + Buffer.byteLength(content, 'utf8') + '\r\n\r\n' + content);
}

// === Strip Comments ===
function strip(code) {
  let r = '', i = 0, inS = false, sC = '';
  while (i < code.length) {
    const c = code[i], n = code[i+1];
    if (!inS && (c === "'" || c === '"')) { inS = true; sC = c; r += c; i++; continue; }
    if (inS && c === sC) { if (n === sC) { r += c; r += n; i += 2; continue; } inS = false; r += c; i++; continue; }
    if (inS) { r += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < code.length && code[i] !== '\n') i++; r += '\n'; continue; }
    if (c === '(' && n === '*') { let d = 1; i += 2; while (i < code.length && d > 0) { if (code[i] === '(' && code[i+1] === '*') { d++; i += 2; } else if (code[i] === '*' && code[i+1] === ')') { d--; i += 2; } else i++; } r += ' '; continue; }
    if (c === '{') { if (code.substring(i, i + 10) === '{attribute') { r += c; i++; continue; } while (i < code.length && code[i] !== '}') i++; if (i < code.length) i++; r += ' '; continue; }
    r += c; i++;
  }
  return r;
}

// === Entity Extractor ===
function kindToType(k) {
  return { 5: 'FUNCTION_BLOCK', 2: 'PROGRAM', 6: 'METHOD', 23: 'TYPE', 10: 'ENUM', 22: 'ENUM_MEMBER', 13: 'VARIABLE', 12: 'VARIABLE', 11: 'INTERFACE' }[k] || null;
}

function toEntities(symbols, file) {
  const entities = [];
  for (const s of symbols || []) {
    const t = kindToType(s.kind);
    if (t) {
      entities.push({ name: s.name, type: t, file: path.basename(file), line: s.location.range.start.line + 1 });
      if (s.children) {
        for (const c of s.children) {
          const ct = kindToType(c.kind);
          if (ct) entities.push({ name: c.name, type: ct, file: path.basename(file), line: c.location.range.start.line + 1, parent: s.name });
        }
      }
    }
  }
  return entities;
}

// === Main ===
async function main() {
  // Init LSP
  const wsUri = 'file:///D:/Codesys/code-graph-rag-mcp/test-trust-workspace';
  await req('initialize', {
    processId: process.pid,
    clientInfo: { name: 'test', version: '1.0.0' },
    rootUri: wsUri,
    workspaceFolders: [{ uri: wsUri, name: 'test' }],
    capabilities: { textDocument: { documentSymbol: {} } }
  });
  notify('initialized', {});
  console.log('✅ LSP initialized\n');

  // Find files
  const files = [];
  function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith('.st')) files.push(fp);
    }
  }
  walk(WORKSPACE_DIR);
  console.log(`Found ${files.length} ST files\n`);

  // Index first 10 files
  const allEntities = [];
  for (const file of files.slice(0, 10)) {
    const content = readFileSync(file, 'utf8');
    const stripped = strip(content);
    const uri = 'file://' + file.replace(/\\/g, '/');

    notify('textDocument/didOpen', { textDocument: { uri, languageId: 'st', version: 1, text: stripped } });
    await new Promise(r => setTimeout(r, 300));

    try {
      const symbols = await req('textDocument/documentSymbol', { textDocument: { uri } });
      const entities = toEntities(symbols, file);
      allEntities.push(...entities);
      console.log(`✅ ${path.basename(file)}: ${entities.length} entities`);
    } catch (e) {
      console.log(`❌ ${path.basename(file)}: ${e.message}`);
    }

    notify('textDocument/didClose', { textDocument: { uri } });
  }

  // Results
  const byType = {};
  for (const e of allEntities) byType[e.type] = (byType[e.type] || 0) + 1;

  console.log(`\n=== RESULTS ===`);
  console.log(`Total entities: ${allEntities.length}`);
  console.log('By type:', JSON.stringify(byType, null, 2));

  console.log('\n=== Sample ===');
  allEntities.slice(0, 15).forEach(e => {
    console.log(`  ${e.type}: ${e.name} (${e.file}, line ${e.line})${e.parent ? ' [child of ' + e.parent + ']' : ''}`);
  });

  // Cleanup
  try { await req('shutdown', {}); } catch (e) {}
  notify('exit', {});
  setTimeout(() => lsp.kill(), 200);

  console.log('\n✅ Pipeline test complete!');
}

main().catch(console.error);
