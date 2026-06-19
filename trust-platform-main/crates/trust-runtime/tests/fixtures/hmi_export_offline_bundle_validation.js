const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { for (const name of names) { if (name) { this.values.add(String(name)); } } }
  remove(...names) { for (const name of names) { this.values.delete(String(name)); } }
  contains(name) { return this.values.has(String(name)); }
  toggle(name, force) {
    const value = String(name);
    if (force === true) { this.values.add(value); return true; }
    if (force === false) { this.values.delete(value); return false; }
    if (this.values.has(value)) { this.values.delete(value); return false; }
    this.values.add(value);
    return true;
  }
}

class StyleDecl {
  setProperty(key, value) {
    this[String(key)] = String(value);
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = new StyleDecl();
    this.dataset = {};
    this.className = '';
    this.classList = new ClassList();
    this.listeners = new Map();
    this.textContent = '';
    this.type = '';
    this.min = '';
    this.max = '';
    this.step = '';
    this.value = '';
    this.disabled = false;
    this.href = '';
    this._innerHTML = '';
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(key, value) {
    this.attrs[String(key)] = String(value);
  }
  getAttribute(key) {
    return this.attrs[String(key)];
  }
  addEventListener(event, handler) {
    const key = String(event);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(handler);
  }
  dispatch(event, payload = {}) {
    const handlers = this.listeners.get(String(event)) || [];
    for (const handler of handlers) {
      handler({ target: this, ...payload });
    }
  }
  querySelector(selector) {
    const match = (node) => {
      if (!(node instanceof FakeElement)) {
        return false;
      }
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        const classes = `${node.className || ''} ${node.attrs.class || ''}`
          .split(/\s+/)
          .filter(Boolean);
        return node.classList.contains(className) || classes.includes(className);
      }
      if (selector.startsWith('#')) {
        return node.attrs.id === selector.slice(1);
      }
      return node.tagName.toLowerCase() === selector.toLowerCase();
    };
    const stack = [...this.children];
    while (stack.length > 0) {
      const node = stack.shift();
      if (match(node)) {
        return node;
      }
      if (node && Array.isArray(node.children)) {
        stack.unshift(...node.children);
      }
    }
    return null;
  }
  get childElementCount() {
    return this.children.length;
  }
  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
}

function responseJson(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

(async () => {
  const bundlePath = process.env.HMI_EXPORT_BUNDLE_PATH;
  assert(bundlePath, 'missing HMI_EXPORT_BUNDLE_PATH');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  assert.strictEqual(bundle.version, 2);
  assert.strictEqual(bundle.entrypoint, 'hmi/index.html');

  const assets = bundle.assets || {};
  const appSource = assets['hmi/app.js'];
  const moduleAssetPaths = [
    'hmi/modules/hmi-model-descriptor.js',
    'hmi/modules/hmi-model-layout.js',
    'hmi/modules/hmi-model-navigation.js',
    'hmi/modules/hmi-model.js',
    'hmi/modules/hmi-renderers.js',
    'hmi/modules/hmi-widgets.js',
    'hmi/modules/hmi-trends-alarms.js',
    'hmi/modules/hmi-process-view.js',
    'hmi/modules/hmi-transport.js',
    'hmi/modules/hmi-pages.js',
  ];
  const moduleSources = moduleAssetPaths.map((path) => assets[path]);
  const indexHtml = assets['hmi/index.html'];
  assert(typeof appSource === 'string' && appSource.length > 0, 'missing exported hmi/app.js');
  assert(moduleSources.every((source) => typeof source === 'string' && source.length > 0), 'missing exported hmi module assets');
  assert(typeof indexHtml === 'string' && indexHtml.includes('id=\"hmiGroups\"'), 'missing exported hmi/index.html shell');

  const schema = bundle.config && bundle.config.schema;
  assert(schema && Array.isArray(schema.widgets) && schema.widgets.length > 0, 'missing schema widgets');

  const valuesById = {};
  for (const widget of schema.widgets) {
    const type = String(widget.data_type || '').toUpperCase();
    let value = 0;
    if (type === 'BOOL') {
      value = false;
    } else if (type.includes('STRING')) {
      value = 'ok';
    } else if (type.includes('REAL') || type.includes('INT') || type.includes('WORD') || type.includes('BYTE') || type.includes('TIME')) {
      value = 1;
    }
    valuesById[widget.id] = { v: value, q: 'good', ts_ms: Date.now() };
  }

  const ids = [
    ['resourceName', 'p'],
    ['connectionState', 'div'],
    ['freshnessState', 'div'],
    ['modeLabel', 'div'],
    ['themeLabel', 'div'],
    ['exportLink', 'a'],
    ['pageSidebar', 'aside'],
    ['pageContent', 'section'],
    ['hmiGroups', 'section'],
    ['trendPanel', 'section'],
    ['alarmPanel', 'section'],
    ['emptyState', 'section'],
  ];
  const elements = new Map();
  for (const [id, tag] of ids) {
    const node = new FakeElement(tag);
    node.setAttribute('id', id);
    elements.set(id, node);
  }

  const listeners = new Map();
  const noop = () => {};
  const context = {
    console,
    URLSearchParams,
    window: {
      location: { protocol: 'http:', host: 'offline.local', search: '' },
      addEventListener: (event, handler) => {
        listeners.set(String(event), handler);
      },
      setInterval: () => 1,
      clearInterval: noop,
      setTimeout: () => 1,
      clearTimeout: noop,
      innerWidth: 1280,
    },
    document: {
      createElement: (tag) => new FakeElement(tag),
      createElementNS: (_ns, tag) => new FakeElement(tag),
      getElementById: (id) => elements.get(String(id)) || null,
      body: new FakeElement('body'),
      documentElement: { style: new StyleDecl() },
    },
    fetch: async (url, init = {}) => {
      if (url !== '/api/control') {
        return responseJson({ ok: false, error: `unexpected route ${url}` }, 404);
      }
      const payload = JSON.parse(init.body || '{}');
      const type = payload.type;
      if (type === 'hmi.schema.get') {
        return responseJson({ ok: true, result: schema });
      }
      if (type === 'hmi.values.get') {
        const requested = Array.isArray(payload.params?.ids)
          ? payload.params.ids
          : Object.keys(valuesById);
        const values = {};
        for (const id of requested) {
          if (Object.prototype.hasOwnProperty.call(valuesById, id)) {
            values[id] = valuesById[id];
          }
        }
        return responseJson({
          ok: true,
          result: { connected: true, timestamp_ms: Date.now(), values },
        });
      }
      if (type === 'hmi.trends.get') {
        return responseJson({
          ok: true,
          result: { connected: true, timestamp_ms: Date.now(), duration_ms: 60000, buckets: 16, series: [] },
        });
      }
      if (type === 'hmi.alarms.get') {
        return responseJson({
          ok: true,
          result: { connected: true, timestamp_ms: Date.now(), active: [], history: [] },
        });
      }
      if (type === 'hmi.alarm.ack') {
        return responseJson({ ok: true, result: { acknowledged: true } });
      }
      return responseJson({ ok: false, error: `unsupported request type ${type}` }, 400);
    },
    DOMParser: class {
      parseFromString() {
        return { querySelector: () => null, documentElement: null };
      }
    },
  };
  context.window.document = context.document;
  vm.createContext(context);

  const source = `${moduleSources.join('\n')}\n${appSource}\n;globalThis.__hmi_test__ = { state };`;
  vm.runInContext(source, context, { filename: 'exported-hmi-app.js' });

  const ready = listeners.get('DOMContentLoaded');
  assert.strictEqual(typeof ready, 'function', 'DOMContentLoaded init handler not registered');
  await ready();

  const test = context.__hmi_test__;
  assert(test && test.state && test.state.schema, 'schema should load during standalone bootstrap');
  assert.strictEqual(test.state.schema.version, schema.version, 'schema version mismatch');
  assert(test.state.cards.size > 0, 'widget cards should render in standalone bootstrap');
  assert.strictEqual(elements.get('connectionState').textContent, 'Connected');
  assert(
    typeof elements.get('freshnessState').textContent === 'string'
      && elements.get('freshnessState').textContent.includes('freshness:'),
    'freshness badge did not render'
  );
  console.log('ok');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
