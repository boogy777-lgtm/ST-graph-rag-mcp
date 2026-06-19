use super::*;

#[test]
fn hmi_process_renderer_handles_malformed_svg_without_crash() {
    let js_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/web/ui/hmi.js");
    let script = r#"
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { for (const name of names) { if (name) { this.values.add(String(name)); } } }
  remove(...names) { for (const name of names) { this.values.delete(String(name)); } }
  contains(name) { return this.values.has(String(name)); }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.className = '';
    this.classList = new ClassList();
    this.textContent = '';
    this.innerHTML = '';
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(key, value) {
    this.attrs[String(key)] = String(value);
  }
}

(async () => {
  const sourcePath = process.env.HMI_JS_PATH;
  const source = fs.readFileSync(sourcePath, 'utf8') + '\n;globalThis.__hmi_test__ = { state, renderProcessPage };';
  const elements = new Map();
  const noop = () => {};
  function element(id, tag = 'div') {
    const node = new FakeElement(tag);
    node.setAttribute('id', id);
    elements.set(id, node);
    return node;
  }
  const groups = element('hmiGroups');
  const empty = element('emptyState');
  element('connectionState');
  element('freshnessState');
  const context = {
    console,
    URLSearchParams,
    window: {
      location: { protocol: 'http:', host: '127.0.0.1:7777', search: '' },
      addEventListener: noop,
      setInterval: () => 1,
      clearInterval: noop,
      setTimeout: () => 1,
      clearTimeout: noop,
      innerWidth: 1200,
    },
    document: {
      createElement: (tag) => new FakeElement(tag),
      createElementNS: (_ns, tag) => new FakeElement(tag),
      getElementById: (id) => elements.get(id) || null,
      body: { classList: new ClassList() },
      documentElement: { style: { setProperty: noop } },
    },
    fetch: async () => ({
      ok: true,
      text: async () => '<svg><broken',
    }),
    DOMParser: class {
      parseFromString() {
        return {
          querySelector(selector) {
            return selector === 'parsererror' ? { textContent: 'invalid svg' } : null;
          },
          documentElement: null,
        };
      }
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'hmi.js' });

  const test = context.__hmi_test__;
  test.state.currentPage = 'process';
  await test.renderProcessPage({
    id: 'process',
    title: 'Process',
    svg: 'malformed.svg',
    bindings: [],
  });
  assert.strictEqual(test.state.processView, null);
  assert.strictEqual(groups.classList.contains('hidden'), false);
  assert.ok(empty.textContent.includes('Process view unavailable'));
  console.log('ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"#;
    run_node_hmi_script(&js_path, script, "malformed process svg");
}

#[test]
fn hmi_process_renderer_rewrites_relative_svg_asset_references() {
    let js_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/web/ui/hmi.js");
    let script = r#"
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const sourcePath = process.env.HMI_JS_PATH;
const source = fs.readFileSync(sourcePath, 'utf8') + '\n;globalThis.__hmi_test__ = { rewriteProcessAssetReferences };';
const noop = () => {};
const context = {
  console,
  URLSearchParams,
  window: {
    location: { protocol: 'http:', host: '127.0.0.1:7777', search: '' },
    addEventListener: noop,
    setInterval: () => 1,
    clearInterval: noop,
    setTimeout: () => 1,
    clearTimeout: noop,
    innerWidth: 1280,
  },
  document: {
    getElementById: () => null,
    body: { classList: { add: noop, remove: noop } },
    documentElement: { style: { setProperty: noop } },
  },
  fetch: async () => { throw new Error('unexpected fetch'); },
  DOMParser: class {
    parseFromString() {
      return { querySelector: () => null, documentElement: null };
    }
  },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'hmi.js' });

const test = context.__hmi_test__;
function node(attrs) {
  return {
    attrs: { ...attrs },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
  };
}

const relative = node({ href: 'pid-symbols/PP001A.svg' });
const relativeParent = node({ href: '../pid-symbols/PT005A.svg' });
const xlinkRelative = node({ 'xlink:href': 'pid-symbols/PV022A.svg' });
const localRef = node({ href: '#tank-001' });
const absoluteRef = node({ href: '/hmi/assets/pid-symbols%2FPP001A.svg' });
const externalRef = node({ href: 'https://example.com/symbol.svg' });
const dataRef = node({ href: 'data:image/svg+xml;base64,AAAA' });

const svgRoot = {
  querySelectorAll() {
    return [relative, relativeParent, xlinkRelative, localRef, absoluteRef, externalRef, dataRef];
  },
};

test.rewriteProcessAssetReferences(svgRoot, 'nested/plant.svg');
assert.strictEqual(relative.attrs.href, '/hmi/assets/nested%2Fpid-symbols%2FPP001A.svg');
assert.strictEqual(relativeParent.attrs.href, '/hmi/assets/pid-symbols%2FPT005A.svg');
assert.strictEqual(xlinkRelative.attrs['xlink:href'], '/hmi/assets/nested%2Fpid-symbols%2FPV022A.svg');
assert.strictEqual(localRef.attrs.href, '#tank-001');
assert.strictEqual(absoluteRef.attrs.href, '/hmi/assets/pid-symbols%2FPP001A.svg');
assert.strictEqual(externalRef.attrs.href, 'https://example.com/symbol.svg');
assert.strictEqual(dataRef.attrs.href, 'data:image/svg+xml;base64,AAAA');
console.log('ok');
"#;
    run_node_hmi_script(&js_path, script, "process asset rewrite");
}
