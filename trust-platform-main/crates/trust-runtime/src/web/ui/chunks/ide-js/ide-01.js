// truST Web IDE – application logic

// ── Constants & Configuration ──────────────────────────

const DRAFT_PREFIX = "trust.ide.draft.";
const THEME_STORAGE_KEY = "trustTheme";
const IDE_LEFT_WIDTH_KEY = "trust.ide.leftWidth";
const IDE_RIGHT_WIDTH_KEY = "trust.ide.rightWidth";
const A11Y_REPORT_LINK = "docs/guides/WEB_IDE_ACCESSIBILITY_BASELINE.md";
const IDE_PRESENCE_CHANNEL = "trust.ide.presence";
const IDE_PRESENCE_STORAGE_KEY = "trust.ide.presence.event";
const IDE_PRESENCE_CLAIM_TTL_MS = 12_000;
const API_DEFAULT_TIMEOUT_MS = 6_000;
const ANALYSIS_TIMEOUT_MS = 3_000;
const SESSION_EXPIRED_TEXT = "invalid or expired session";
const ST_LANGUAGE_ID = "trust-st";
const MONACO_MARKER_OWNER = "trust.ide";
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const RECENT_PROJECTS_KEY = "trust.ide.recentProjects";
const MAX_RECENT_PROJECTS = 10;
const IDE_SESSION_STORAGE_KEY = "trust.ide.session";

// ── State ──────────────────────────────────────────────

let monaco;
let ensureStyleInjected = () => {};
let completionProviderDisposable = null;
let hoverProviderDisposable = null;
let startCompletion = () => {};
let cursorInsightTimer = null;
let completionTriggerTimer = null;
let cursorHoverPopupTimer = null;
let documentHighlightDecorations = [];
let documentHighlightTimer = null;
let wasmClient = null;

const state = {
  tabId: TAB_ID,
  online: navigator.onLine,
  ready: false,
  sessionToken: null,
  writeEnabled: false,
  files: [],
  tree: [],
  activeProject: null,
  startupProject: null,
  fileFilter: "",
  selectedPath: null,
  expandedDirs: new Set([""]),
  openTabs: new Map(),
  activePath: null,
  editorView: null,
  secondaryEditorView: null,
  secondaryPath: null,
  secondaryOpenTabs: new Set(),
  splitEnabled: false,
  activePane: "primary",
  diagnostics: [],
  references: [],
  searchHits: [],
  latencySamples: [],
  diagnosticsTimer: null,
  diagnosticsTicket: 0,
  autosaveTimer: null,
  healthTimer: null,
  telemetryTimer: null,
  taskPollTimer: null,
  suppressEditorChange: false,
  editorDisposables: [],
  activeTaskId: null,
  lastFailedAction: null,
  presenceChannel: null,
  peerClaims: new Map(),
  collisionPath: null,
  analysis: {
    degraded: false,
    consecutiveFailures: 0,
    lastNoticeAtMs: 0,
  },
  telemetry: {
    bootstrap_failures: 0,
    analysis_timeouts: 0,
    worker_restarts: 0,
    autosave_failures: 0,
  },
  uiMode: "runtime",
  standaloneMode: false,
  commandFilter: "",
  commands: [],
  selectedCommandIndex: 0,
  contextPath: null,
  browseVisible: false,
};

// ── DOM References ─────────────────────────────────────

const el = {
  fileTree: document.getElementById("fileTree"),
  fileFilterInput: document.getElementById("fileFilterInput"),
  newFileBtn: document.getElementById("newFileBtn"),
  newFolderBtn: document.getElementById("newFolderBtn"),
  renamePathBtn: document.getElementById("renamePathBtn"),
  deletePathBtn: document.getElementById("deletePathBtn"),
  breadcrumbBar: document.getElementById("breadcrumbBar"),
  sidebarResizeHandle: document.getElementById("sidebarResizeHandle"),
  tabBar: document.getElementById("tabBar"),
  ideTitle: document.getElementById("ideTitle"),
  headerSyncBadge: document.getElementById("headerSyncBadge"),
  headerSyncPopover: document.getElementById("headerSyncPopover"),
  scopeNote: document.getElementById("scopeNote"),
  statusMode: document.getElementById("statusMode"),
  statusProject: document.getElementById("statusProject"),
  connectionPill: document.getElementById("connectionPill"),
  connectionPillText: document.getElementById("connectionPillText"),
  runtimeState: document.getElementById("runtimeState"),
  alarmCount: document.getElementById("alarmCount"),
  statusText: document.getElementById("statusText"),
  draftInfo: document.getElementById("draftInfo"),
  ideToast: document.getElementById("ideToast"),
  editorTitle: document.getElementById("editorTitle"),
  cursorLabel: document.getElementById("cursorLabel"),
  problemsPanel: document.getElementById("problemsPanel"),
  referencesPanel: document.getElementById("referencesPanel"),
  searchPanel: document.getElementById("searchPanel"),
  taskStatus: document.getElementById("taskStatus"),
  retryActionBtn: document.getElementById("retryActionBtn"),
  taskOutput: document.getElementById("taskOutput"),
  taskLinksPanel: document.getElementById("taskLinksPanel"),
  healthPanel: document.getElementById("healthPanel"),
  statusLatency: document.getElementById("statusLatency"),
  editorPanePrimary: document.getElementById("editorPanePrimary"),
  editorPaneSecondary: document.getElementById("editorPaneSecondary"),
  editorMount: document.getElementById("editorMount"),
  editorMountSecondary: document.getElementById("editorMountSecondary"),
  tabBarPrimary: document.getElementById("tabBarPrimary"),
  tabBarSecondary: document.getElementById("tabBarSecondary"),
  insightResizeHandle: document.getElementById("insightResizeHandle"),
  editorWelcome: document.getElementById("editorWelcome"),
  welcomeNewProjectBtn: document.getElementById("welcomeNewProjectBtn"),
  welcomeOpenBtn: document.getElementById("welcomeOpenBtn"),
  welcomeQuickOpenBtn: document.getElementById("welcomeQuickOpenBtn"),
  editorGrid: document.getElementById("editorGrid"),
  saveBtn: document.getElementById("saveBtn"),
  saveAllBtn: document.getElementById("saveAllBtn"),
  validateBtn: document.getElementById("validateBtn"),
  buildBtn: document.getElementById("buildBtn"),
  testBtn: document.getElementById("testBtn"),
  splitBtn: document.getElementById("splitBtn"),
  settingsBackToFormBtn: document.getElementById("settingsBackToFormBtn"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  openProjectBtn: document.getElementById("openProjectBtn"),
  quickOpenBtn: document.getElementById("quickOpenBtn"),
  headerMoreActions: document.getElementById("headerMoreActions"),
  moreActionsBtn: document.getElementById("moreActionsBtn"),
  moreActionsMenu: document.getElementById("moreActionsMenu"),
  themeToggle: document.getElementById("themeToggle"),
  commandPalette: document.getElementById("commandPalette"),
  commandInput: document.getElementById("commandInput"),
  commandList: document.getElementById("commandList"),
  cmdPaletteBtn: document.getElementById("cmdPaletteBtn"),
  treeContextMenu: document.getElementById("treeContextMenu"),
  ctxOpenBtn: document.getElementById("ctxOpenBtn"),
  ctxNewFileBtn: document.getElementById("ctxNewFileBtn"),
  ctxNewFolderBtn: document.getElementById("ctxNewFolderBtn"),
  ctxRenameBtn: document.getElementById("ctxRenameBtn"),
  ctxDeleteBtn: document.getElementById("ctxDeleteBtn"),
  inputModal: document.getElementById("inputModal"),
  inputModalTitle: document.getElementById("inputModalTitle"),
  inputModalField: document.getElementById("inputModalField"),
  inputModalOk: document.getElementById("inputModalOk"),
  inputModalCancel: document.getElementById("inputModalCancel"),
  confirmModal: document.getElementById("confirmModal"),
  confirmModalTitle: document.getElementById("confirmModalTitle"),
  confirmModalMessage: document.getElementById("confirmModalMessage"),
  confirmModalOk: document.getElementById("confirmModalOk"),
  confirmModalCancel: document.getElementById("confirmModalCancel"),
  openProjectPanel: document.getElementById("openProjectPanel"),
  openProjectInput: document.getElementById("openProjectInput"),
  openProjectRecent: document.getElementById("openProjectRecent"),
  openProjectOk: document.getElementById("openProjectOk"),
  openProjectCancel: document.getElementById("openProjectCancel"),
  browseBtn: document.getElementById("browseBtn"),
  browseListing: document.getElementById("browseListing"),
  browseBreadcrumbs: document.getElementById("browseBreadcrumbs"),
  browseEntries: document.getElementById("browseEntries"),
  newProjectModal: document.getElementById("newProjectModal"),
  newProjectName: document.getElementById("newProjectName"),
  newProjectLocation: document.getElementById("newProjectLocation"),
  newProjectBrowseBtn: document.getElementById("newProjectBrowseBtn"),
  newProjectTemplate: document.getElementById("newProjectTemplate"),
  newProjectPreview: document.getElementById("newProjectPreview"),
  newProjectOk: document.getElementById("newProjectOk"),
  newProjectCancel: document.getElementById("newProjectCancel"),
  hardwarePalette: document.getElementById("hardwarePalette"),
  hwWorkspace: document.getElementById("hwWorkspace"),
  hwEmptyState: document.getElementById("hwEmptyState"),
  hwPresets: document.getElementById("hwPresets"),
  hwSummary: document.getElementById("hwSummary"),
  hwCanvas: document.getElementById("hwCanvas"),
  hwAddressTable: document.getElementById("hwAddressTable"),
  hwDriverCards: document.getElementById("hwDriverCards"),
  hwPropertyPanel: document.getElementById("hwPropertyPanel"),
  hwRuntimeSelect: document.getElementById("hwRuntimeSelect"),
  hwTransportPills: document.getElementById("hwTransportPills"),
  hwViewCanvas: document.getElementById("hwViewCanvas"),
  hwViewTable: document.getElementById("hwViewTable"),
  hwFitCanvasBtn: document.getElementById("hwFitCanvasBtn"),
  hwCenterCanvasBtn: document.getElementById("hwCenterCanvasBtn"),
  hwToggleInspectorBtn: document.getElementById("hwToggleInspectorBtn"),
  hwToggleDriversBtn: document.getElementById("hwToggleDriversBtn"),
  hwFullscreenBtn: document.getElementById("hwFullscreenBtn"),
  hwCanvasToolbar: document.getElementById("hwCanvasToolbar"),
  hwLegendToggleBtn: document.getElementById("hwLegendToggleBtn"),
  hwLegend: document.getElementById("hwLegend"),
  hwDriversPanel: document.getElementById("hwDriversPanel"),
  hwDriversPanelToggleBtn: document.getElementById("hwDriversPanelToggleBtn"),
  hwReloadConfigBtn: document.getElementById("hwReloadConfigBtn"),
  hwNodeContextMenu: document.getElementById("hwNodeContextMenu"),
  hwEdgeContextMenu: document.getElementById("hwEdgeContextMenu"),
  hwCtxCreateLinkBtn: document.getElementById("hwCtxCreateLinkBtn"),
  hwCtxRuntimeSettingsBtn: document.getElementById("hwCtxRuntimeSettingsBtn"),
  hwCtxRuntimeCommSettingsBtn: document.getElementById("hwCtxRuntimeCommSettingsBtn"),
  hwCtxCreateLinkFromEdgeBtn: document.getElementById("hwCtxCreateLinkFromEdgeBtn"),
  hwCtxEditLinkBtn: document.getElementById("hwCtxEditLinkBtn"),
  hwCtxDeleteLinkBtn: document.getElementById("hwCtxDeleteLinkBtn"),
  hwCtxOpenLinkSettingsBtn: document.getElementById("hwCtxOpenLinkSettingsBtn"),
  hwCtxOpenTransportSettingsBtn: document.getElementById("hwCtxOpenTransportSettingsBtn"),
  connectionDialog: document.getElementById("connectionDialog"),
  connectionDialogClose: document.getElementById("connectionDialogClose"),
  connectAddress: document.getElementById("connectAddress"),
  connectPort: document.getElementById("connectPort"),
  connectAuthFields: document.getElementById("connectAuthFields"),
  connectUsername: document.getElementById("connectUsername"),
  connectPassword: document.getElementById("connectPassword"),
  connectBtn: document.getElementById("connectBtn"),
  connectStatus: document.getElementById("connectStatus"),
  connectionRetryBtn: document.getElementById("connectionRetryBtn"),
  discoveredRuntimes: document.getElementById("discoveredRuntimes"),
  recentConnections: document.getElementById("recentConnections"),
  deployBtn: document.getElementById("deployBtn"),
  syncBadge: document.getElementById("syncBadge"),
  liveValuesToggle: document.getElementById("liveValuesToggle"),
  debugToolbar: document.getElementById("debugToolbar"),
  debugForceBanner: document.getElementById("debugForceBanner"),
  debugVariablesPanel: document.getElementById("debugVariablesPanel"),
  debugCallStackPanel: document.getElementById("debugCallStackPanel"),
  debugWatchPanel: document.getElementById("debugWatchPanel"),
  settingsCategories: document.getElementById("settingsCategories"),
  settingsFormPanel: document.getElementById("settingsFormPanel"),
  logsSources: document.getElementById("logsSources"),
  logsFilterBar: document.getElementById("logsFilterBar"),
  logsTablePanel: document.getElementById("logsTablePanel"),
};

// ── Utilities ──────────────────────────────────────────

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isStructuredTextPath(path) {
  return String(path || "").toLowerCase().endsWith(".st");
}

function formatTimestampMs(value) {
  const asNumber = Number(value || 0);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return "--";
  }
  return new Date(asNumber).toLocaleTimeString();
}

function setStatus(text) {
  el.statusText.textContent = text;
}

function bumpTelemetry(key, amount = 1) {
  const current = Number(state.telemetry[key] || 0);
  state.telemetry[key] = current + amount;
}

function isTimeoutMessage(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("timeout");
}

function bindAction(element, action, errorLabel) {
  element.addEventListener("click", () => {
    action().catch((error) => {
      if (errorLabel) setStatus(`${errorLabel}: ${error.message || error}`);
    });
  });
}

// ── API Layer ──────────────────────────────────────────

function apiHeaders(extra = {}, includeSession = true) {
  const headers = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (includeSession && state.sessionToken) {
    headers["X-Trust-Ide-Session"] = state.sessionToken;
  }
  return headers;
}

function clearStoredIdeSession() {
  try {
    localStorage.removeItem(IDE_SESSION_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function loadStoredIdeSession(expectedRole) {
  try {
    const raw = localStorage.getItem(IDE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
    const role = typeof parsed?.role === "string" ? parsed.role.trim().toLowerCase() : "";
    if (!token || !role) return null;
    if (expectedRole && role !== String(expectedRole).toLowerCase()) return null;
    return { token, role };
  } catch {
    return null;
  }
}

function persistIdeSession(token, role) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!normalizedToken || !normalizedRole) {
    clearStoredIdeSession();
    return;
  }
  try {
    localStorage.setItem(
      IDE_SESSION_STORAGE_KEY,
      JSON.stringify({
        token: normalizedToken,
        role: normalizedRole,
        saved_at_ms: Date.now(),
      }),
    );
  } catch {
    // ignore storage failures
  }
}

async function requestNewSession(preferredRole) {
  const role = preferredRole || (state.writeEnabled ? "editor" : "viewer");
  const response = await fetch("/api/ide/session", {
    method: "POST",
    headers: apiHeaders({}, false),
    body: JSON.stringify({role}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload.ok === false) {
