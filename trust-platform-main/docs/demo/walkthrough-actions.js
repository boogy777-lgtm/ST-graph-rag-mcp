const ACTIONS = [
  {
    step: 1,
    fileIndex: 2,
    fileUri: "program.st",
    focus: { lineNumber: 12, column: 1 },
    commandId: null,
    commandDelayMs: 0,
  },
  {
    step: 2,
    fileIndex: 2,
    fileUri: "program.st",
    focus: { lineNumber: 3, column: 12 },
    commandId: null,
    commandDelayMs: 0,
  },
  {
    step: 3,
    fileIndex: 1,
    fileUri: "fb_pump.st",
    focus: { lineNumber: 17, column: 8 },
    commandId: "editor.action.triggerSuggest",
    commandDelayMs: 60,
  },
  {
    step: 4,
    fileIndex: 2,
    fileUri: "program.st",
    focus: { lineNumber: 19, column: 22 },
    commandId: null,
    commandDelayMs: 0,
  },
  {
    step: 5,
    fileIndex: 2,
    fileUri: "program.st",
    focus: { lineNumber: 12, column: 5 },
    commandId: "editor.action.referenceSearch.trigger",
    commandDelayMs: 90,
  },
  {
    step: 6,
    fileIndex: 1,
    fileUri: "fb_pump.st",
    focus: { lineNumber: 10, column: 5 },
    commandId: null,
    commandDelayMs: 0,
  },
  {
    step: 7,
    fileIndex: 0,
    fileUri: "types.st",
    focus: { lineNumber: 14, column: 9 },
    commandId: "editor.action.rename",
    commandDelayMs: 90,
  },
];

export const WALKTHROUGH_ACTIONS = Object.freeze(
  ACTIONS.map((action) =>
    Object.freeze({
      ...action,
      focus: action.focus ? Object.freeze({ ...action.focus }) : null,
    })),
);

export function getWalkthroughAction(index) {
  if (!Number.isInteger(index)) return null;
  if (index < 0 || index >= WALKTHROUGH_ACTIONS.length) return null;
  return WALKTHROUGH_ACTIONS[index];
}
