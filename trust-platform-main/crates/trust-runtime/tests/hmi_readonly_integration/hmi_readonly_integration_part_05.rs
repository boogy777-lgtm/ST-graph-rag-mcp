use super::*;

#[test]
fn hmi_process_page_schema_and_svg_asset_route_render() {
    let root = temp_dir("process-page");
    write_file(
        &root.join("hmi/plant.toml"),
        r##"
title = "Plant"
kind = "process"
order = 70
svg = "plant.svg"

[[bind]]
selector = "#pump1-status"
attribute = "fill"
source = "Main.run"
map = { true = "#22c55e", false = "#94a3b8" }

[[bind]]
selector = "#tank1-level"
attribute = "height"
source = "Main.speed"
scale = { min = 0, max = 100, output_min = 0, output_max = 180 }

[[bind]]
selector = "svg #unsafe"
attribute = "fill"
source = "Main.run"

[[bind]]
attribute = "opacity"
source = "Main.speed"
"##,
    );
    write_file(
        &root.join("hmi/plant.svg"),
        r##"<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><circle id="pump1-status" cx="20" cy="20" r="10" fill="#999"/><rect id="tank1-level" x="80" y="10" width="20" height="0"/></svg>"##,
    );

    let state = hmi_control_state_with_root(hmi_fixture_source(), Some(root.clone()));
    let base = start_test_server(state);

    let svg = ureq::get(&format!("{base}/hmi/assets/plant.svg"))
        .call()
        .expect("get process svg asset")
        .body_mut()
        .read_to_string()
        .expect("read svg asset body");
    assert!(svg.contains("pump1-status"));
    assert!(svg.contains("tank1-level"));

    let schema = post_control(&base, "hmi.schema.get", None);
    assert_eq!(schema.get("ok").and_then(|v| v.as_bool()), Some(true));
    let page = schema
        .get("result")
        .and_then(|v| v.get("pages"))
        .and_then(|v| v.as_array())
        .and_then(|pages| {
            pages
                .iter()
                .find(|page| page.get("id").and_then(|v| v.as_str()) == Some("plant"))
        })
        .expect("plant page");
    assert_eq!(page.get("kind").and_then(|v| v.as_str()), Some("process"));
    assert_eq!(page.get("svg").and_then(|v| v.as_str()), Some("plant.svg"));
    let bindings = page
        .get("bindings")
        .and_then(|v| v.as_array())
        .expect("process bindings");
    assert_eq!(bindings.len(), 2);
    assert!(bindings.iter().any(|entry| {
        entry.get("selector").and_then(|v| v.as_str()) == Some("#pump1-status")
            && entry.get("attribute").and_then(|v| v.as_str()) == Some("fill")
            && entry
                .get("map")
                .and_then(|v| v.get("true"))
                .and_then(|v| v.as_str())
                == Some("#22c55e")
    }));
    assert!(bindings.iter().any(|entry| {
        entry.get("selector").and_then(|v| v.as_str()) == Some("#tank1-level")
            && entry.get("attribute").and_then(|v| v.as_str()) == Some("height")
            && entry
                .get("scale")
                .and_then(|v| v.get("output_max"))
                .and_then(|v| v.as_f64())
                == Some(180.0)
    }));

    fs::remove_dir_all(root).ok();
}

#[test]
fn hmi_process_binding_transforms_update_fill_opacity_text_y_and_height() {
    let js_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/web/ui/hmi.js");
    let script = r#"
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const sourcePath = process.env.HMI_JS_PATH;
const source = fs.readFileSync(sourcePath, 'utf8') + '\n;globalThis.__hmi_test__ = { state, applyProcessValueEntries };';
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
const fillTarget = { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, textContent: '' };
const opacityTarget = { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, textContent: '' };
const textTarget = { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, textContent: '' };
const yTarget = { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, textContent: '' };
const heightTarget = { attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, textContent: '' };

test.state.processView = {
  bindingsByWidgetId: new Map([
    ['run', [{ target: fillTarget, attribute: 'fill', format: null, map: { true: '#22c55e', false: '#94a3b8' }, scale: null }]],
    ['pressure', [
      { target: opacityTarget, attribute: 'opacity', format: null, map: null, scale: null },
      { target: textTarget, attribute: 'text', format: '{:.1f} bar', map: null, scale: null },
    ]],
    ['level', [{ target: yTarget, attribute: 'y', format: null, map: null, scale: { min: 0, max: 100, output_min: 0, output_max: 180 } }]],
    ['volume', [{ target: heightTarget, attribute: 'height', format: null, map: null, scale: { min: 0, max: 100, output_min: 0, output_max: 240 } }]],
  ]),
};

test.applyProcessValueEntries({
  run: { v: true, q: 'good', ts_ms: 1 },
  pressure: { v: 42.34, q: 'good', ts_ms: 1 },
  level: { v: 50, q: 'good', ts_ms: 1 },
  volume: { v: 25, q: 'good', ts_ms: 1 },
}, 1234);

assert.strictEqual(fillTarget.attrs.fill, '#22c55e');
assert.strictEqual(opacityTarget.attrs.opacity, '42.34');
assert.strictEqual(textTarget.textContent, '42.3 bar');
assert.strictEqual(yTarget.attrs.y, '90');
assert.strictEqual(heightTarget.attrs.height, '60');
console.log('ok');
"#;
    run_node_hmi_script(&js_path, script, "process transform");
}
