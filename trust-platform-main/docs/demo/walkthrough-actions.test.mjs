import test from "node:test";
import assert from "node:assert/strict";

import { WALKTHROUGH_ACTIONS, getWalkthroughAction } from "./walkthrough-actions.js";

test("walkthrough has exactly seven scripted actions", () => {
  assert.equal(WALKTHROUGH_ACTIONS.length, 7);
});

test("step 1 diagnostics opens program without auto command", () => {
  const action = getWalkthroughAction(0);
  assert.equal(action.step, 1);
  assert.equal(action.fileUri, "program.st");
  assert.deepEqual(action.focus, { lineNumber: 12, column: 1 });
  assert.equal(action.commandId, null);
});

test("step 2 hover targets FB_Pump in program.st", () => {
  const action = getWalkthroughAction(1);
  assert.equal(action.step, 2);
  assert.equal(action.fileUri, "program.st");
  assert.deepEqual(action.focus, { lineNumber: 3, column: 12 });
  assert.equal(action.commandId, null);
});

test("step 3 completion triggers suggest at Status member access", () => {
  const action = getWalkthroughAction(2);
  assert.equal(action.step, 3);
  assert.equal(action.fileUri, "fb_pump.st");
  assert.deepEqual(action.focus, { lineNumber: 17, column: 8 });
  assert.equal(action.commandId, "editor.action.triggerSuggest");
});

test("step 4 definition targets program enum use without auto-command", () => {
  const action = getWalkthroughAction(3);
  assert.equal(action.step, 4);
  assert.equal(action.fileUri, "program.st");
  assert.deepEqual(action.focus, { lineNumber: 19, column: 22 });
  assert.equal(action.commandId, null);
});

test("step 5 references anchors program usage and triggers reference search", () => {
  const action = getWalkthroughAction(4);
  assert.equal(action.step, 5);
  assert.equal(action.fileUri, "program.st");
  assert.deepEqual(action.focus, { lineNumber: 12, column: 5 });
  assert.equal(action.commandId, "editor.action.referenceSearch.trigger");
});

test("step 6 highlights opens fb_pump ramp symbol", () => {
  const action = getWalkthroughAction(5);
  assert.equal(action.step, 6);
  assert.equal(action.fileUri, "fb_pump.st");
  assert.deepEqual(action.focus, { lineNumber: 10, column: 5 });
  assert.equal(action.commandId, null);
});

test("step 7 rename targets ActualSpeed and runs rename command", () => {
  const action = getWalkthroughAction(6);
  assert.equal(action.step, 7);
  assert.equal(action.fileUri, "types.st");
  assert.deepEqual(action.focus, { lineNumber: 14, column: 9 });
  assert.equal(action.commandId, "editor.action.rename");
});
