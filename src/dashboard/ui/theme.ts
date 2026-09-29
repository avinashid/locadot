/**
 * The dashboard's styles: design tokens, base, app shell, shared components, pages, responsive rules.
 *
 * Component classes other page code should use (see core.ts for the JS helpers):
 *   Page header   .page-head > .page-title + .page-sub + .page-actions (actions sit right, wrap under on mobile)
 *   Cards         .card > .card-head (.card-title-wrap > .card-title/.card-desc, .card-tools) + .card-body + .card-foot
 *                 .card-body-tight (no padding, for lists), .card-interactive (hover lift), .card-flush (no shadow)
 *   Buttons       .btn (secondary) | .btn-primary | .btn-secondary | .btn-ghost | .btn-danger | .btn-danger-solid | .btn-ghost-danger
 *                 sizes .btn-sm / .btn-lg, square icon button .btn-icon, "more" button .btn-more (or makeMoreButton()), .btn-block, .busy
 *   Forms         .field > label + .input / select.input, .field-hint, .field-error, .input-sm, .input-search
 *                 .switch[role=switch] > .switch-knob (toggle .on + aria-checked), native checkbox is restyled,
 *                 .check-card (label wrapping a checkbox/radio + .check-card-body > .check-card-title/.check-card-desc), .option-card
 *   Badges        .badge + .badge-up/.badge-down/.badge-warn/.badge-accent/.badge-muted, .badge-dot (leading dot), .badges (row)
 *   Dots          .dot + .up/.down/.warn/.accent
 *   Tabs          .tabs[role=tablist][data-tabs=<view>] > button[role=tab][data-tab=<name>]; panels [role=tabpanel][data-tab-panel=<name>]
 *   Menu          built by openMenu(); .menu, .menu-item, .menu-sep, .menu-info; sheet on <=640px
 *   Dialogs       <dialog> > .modal-head (.modal-title, .modal-sub, .modal-close) + .modal-body + .modal-foot; bottom sheet on <=640px
 *   Empty state   .empty > .empty-icon + .empty-title + .empty-desc (or p) + .empty-actions
 *   Skeletons     .skel-bar, .skel-line, .skel-circle, .skel-block
 *   Motion        .anim-in (one element), .anim-list (children stagger in); all motion off under prefers-reduced-motion
 *   Tooltips      data-tip="text" on any element (data-tip-pos="right|bottom|top")
 */

export const lightVars = `
  color-scheme: light;
  --bg: #f7f7f8;
  --surface: #ffffff;
  --surface-2: #f4f4f5;
  --surface-3: #ebebee;
  --surface-raised: #ffffff;
  --border: #e6e6ea;
  --border-strong: #d4d4da;
  --fg: #0b0b0f;
  --fg-2: #3f3f47;
  --muted: #676773;
  --muted-dim: #a1a1ab;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --accent-hover: #1d4ed8;
  --accent-bg: rgba(37, 99, 235, 0.08);
  --accent-ring: rgba(37, 99, 235, 0.25);
  --accent-fg: #ffffff;
  --up: #16a34a;
  --up-bg: rgba(22, 163, 74, 0.1);
  --down: #dc2626;
  --down-bg: rgba(220, 38, 38, 0.08);
  --down-ring: rgba(220, 38, 38, 0.22);
  --warn: #c2680a;
  --warn-bg: rgba(217, 119, 6, 0.1);
  --focus: #2563eb;
  --overlay: rgba(12, 12, 16, 0.38);
  --nav-active: rgba(12, 12, 16, 0.055);
  --tooltip-bg: #18181b;
  --tooltip-fg: #fafafa;
  --shadow-xs: 0 1px 2px rgba(16, 16, 24, 0.05);
  --shadow-sm: 0 1px 2px rgba(16, 16, 24, 0.05), 0 1px 3px rgba(16, 16, 24, 0.04);
  --shadow-md: 0 4px 12px rgba(16, 16, 24, 0.08), 0 1px 3px rgba(16, 16, 24, 0.06);
  --shadow-lg: 0 16px 40px rgba(16, 16, 24, 0.16), 0 2px 6px rgba(16, 16, 24, 0.06);
`;

export const css = `
:root {
  color-scheme: dark;
  --bg: #09090b;
  --surface: #111114;
  --surface-2: #18181c;
  --surface-3: #222227;
  --surface-raised: #1a1a1f;
  --border: #25252b;
  --border-strong: #34343c;
  --fg: #f4f4f5;
  --fg-2: #cfcfd6;
  --muted: #8f8f9a;
  --muted-dim: #5f5f6a;
  --accent: #3b82f6;
  --accent-strong: #60a5fa;
  --accent-hover: #2f6fe0;
  --accent-bg: rgba(59, 130, 246, 0.14);
  --accent-ring: rgba(96, 165, 250, 0.35);
  --accent-fg: #ffffff;
  --up: #22c55e;
  --up-bg: rgba(34, 197, 94, 0.14);
  --down: #f05252;
  --down-bg: rgba(239, 68, 68, 0.14);
  --down-ring: rgba(239, 68, 68, 0.3);
  --warn: #f59e0b;
  --warn-bg: rgba(245, 158, 11, 0.14);
  --focus: #60a5fa;
  --overlay: rgba(0, 0, 0, 0.6);
  --nav-active: rgba(255, 255, 255, 0.06);
  --tooltip-bg: #f4f4f5;
  --tooltip-fg: #111114;
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.02);
  --shadow-lg: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04);

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-full: 999px;
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px;
  --fs-xs: 11.5px; --fs-sm: 12.5px; --fs-base: 14px; --fs-md: 15px; --fs-lg: 18px; --fs-xl: 22px; --fs-2xl: 28px;
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --dur-1: 120ms; --dur-2: 180ms; --dur-3: 240ms;
  --ring: 0 0 0 3px var(--accent-ring);
  --topbar-h: 56px;
  --bottombar-h: 60px;
  --safe-b: env(safe-area-inset-bottom, 0px);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {${lightVars}}
}
:root[data-theme="light"] {${lightVars}}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--sans);
  font-size: var(--fs-base);
  color: var(--fg);
  line-height: 1.5;
  background: var(--bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
::selection { background: var(--accent-ring); }
.mono { font-family: var(--mono); font-feature-settings: normal; }
a { color: var(--accent); text-decoration: none; }
a:hover, a:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
button, input, select, textarea { font-family: inherit; }
button { -webkit-tap-highlight-color: transparent; }
*:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.clip-helper { position: absolute; left: -9999px; top: -9999px; }
.muted { color: var(--muted); }
.dim { color: var(--muted-dim); }
.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.01em;
}
.text-sm { font-size: var(--fs-sm); }
.text-xs { font-size: var(--fs-xs); }
.nowrap { white-space: nowrap; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.stack { display: flex; flex-direction: column; gap: var(--s-3); }
.row { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
.spacer { flex: 1; }
kbd { font-family: var(--mono); font-size: 11px; padding: 1px 5px; border: 1px solid var(--border-strong); border-bottom-width: 2px; border-radius: 4px; background: var(--surface-2); color: var(--fg-2); }

/* ---------- top bar ---------- */
header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  header {
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    backdrop-filter: saturate(180%) blur(12px);
  }
}
.topbar {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 32px;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo {
  width: 24px; height: 24px;
  border-radius: 7px;
  background: linear-gradient(145deg, #4f8ff7, var(--accent) 55%, #1e4fd6);
  position: relative;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 1px 2px rgba(37, 99, 235, 0.35);
}
.logo::after {
  content: "";
  position: absolute;
  left: 8px; top: 8px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fff;
}
.wordmark {
  font-size: 15px;
  font-weight: 650;
  margin: 0;
  letter-spacing: -0.02em;
  color: var(--fg);
}
.crumbs { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13.5px; }
.crumb-root { color: var(--muted); }
.crumb-sep { color: var(--muted-dim); }
.crumb-current { color: var(--fg); font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; }
.btn.theme-toggle { width: 32px; height: 32px; padding: 0; border-radius: var(--radius-full); color: var(--muted); flex-shrink: 0; }
.btn.theme-toggle:hover { color: var(--fg); }
.theme-toggle svg { width: 16px; height: 16px; flex-shrink: 0; display: none; }
.theme-toggle[data-mode="system"] .i-system, .theme-toggle[data-mode="light"] .i-light, .theme-toggle[data-mode="dark"] .i-dark { display: block; }
#updated { color: var(--muted-dim); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.chip:empty { display: none; }
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px 0 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-xs);
  color: var(--fg-2);
  font: 500 12.5px var(--sans);
  white-space: nowrap;
  cursor: pointer;
  min-width: 0;
  transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, transform var(--dur-1) ease;
}
.status-pill:hover { border-color: var(--border-strong); background: var(--surface-2); }
.status-pill:active { transform: scale(0.97); }
.status-pill[aria-expanded="true"] { border-color: var(--border-strong); background: var(--surface-2); }
.status-extra { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 0; }
.status-extra:empty { display: none; }
.status-sep { width: 1px; height: 12px; background: var(--border-strong); flex-shrink: 0; }
.status-caret { width: 14px; height: 14px; flex-shrink: 0; color: var(--muted-dim); fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform var(--dur-2) var(--ease); }
.status-pill[aria-expanded="true"] .status-caret { transform: rotate(180deg); }
body.offline .status-pill { color: var(--down); border-color: var(--down-ring); background: var(--down-bg); }
.chip-live { color: var(--fg-2); font-weight: 500; }
.live-dot {
  position: relative;
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--muted-dim);
  flex-shrink: 0;
}
.live-dot.up { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.live-dot.up::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--up);
  animation: live-ping 2.4s var(--ease) infinite;
}
.live-dot.down { background: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
body.offline .live-label { color: var(--down); }
@keyframes live-ping { 0% { transform: scale(1); opacity: 0.55; } 70%, 100% { transform: scale(2.6); opacity: 0; } }

/* ---------- sidebar / rail / bottom bar ---------- */
:root { --sb-w: 240px; }
.sidebar {
  position: fixed;
  top: 0; bottom: 0; left: 0;
  z-index: 7;
  width: var(--sb-w);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.shell { margin-left: var(--sb-w); min-height: 100vh; display: flex; flex-direction: column; }
.shell > main { flex: 1; width: 100%; }
.sb-head { height: var(--topbar-h); display: flex; align-items: center; gap: 10px; padding: 0 18px; flex-shrink: 0; white-space: nowrap; }
.sb-brand { display: flex; align-items: center; gap: 10px; color: inherit; min-width: 0; }
.sb-brand:hover { text-decoration: none; }
.sb-version, #version { font-size: 11px; color: var(--muted); font-family: var(--mono); padding: 1px 6px; border: 1px solid var(--border); border-radius: var(--radius-full); }
#version:empty { display: none; }
.sb-links { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.sb-group { display: flex; flex-direction: column; gap: 2px; }
.sb-section { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-dim); padding: 18px 12px 6px; white-space: nowrap; }
.sb-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--muted);
  font: 500 13.5px var(--sans);
  white-space: nowrap;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background-color var(--dur-1) ease, color var(--dur-1) ease;
}
.sb-link:hover { background: var(--nav-active); color: var(--fg); text-decoration: none; }
.sb-link:active { background: var(--surface-3); }
.sb-link[aria-current] { background: var(--nav-active); color: var(--fg); }
.sb-link[aria-current] svg { color: var(--accent); }
.sb-link:focus-visible { outline-offset: -2px; }
.sb-link svg { position: relative; z-index: 1; width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; transition: transform var(--dur-2) var(--ease); }
.sb-badges { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
.sb-count { font-size: 11px; font-weight: 600; min-width: 20px; height: 18px; padding: 0 6px; border-radius: var(--radius-full); background: var(--surface-3); color: var(--fg-2); display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.sb-count-accent { background: var(--accent-bg); color: var(--accent); }
.sb-count-accent::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; margin-right: 4px; }
.sb-dot { margin-left: 0; }
.sb-foot { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
.sb-collapse svg { transition: transform var(--dur-2) var(--ease); }
.sb-signout[hidden] { display: none; }
.sb-menu, .brand-mobile { display: none; }
.btn.sb-menu { display: none; }
.sb-backdrop { position: fixed; inset: 0; z-index: 6; background: var(--overlay); }
.card, details.card { scroll-margin-top: 76px; }
@media (min-width: 641px) {
  :root[data-sidebar="collapsed"] { --sb-w: 64px; }
  :root[data-sidebar="collapsed"] .sb-label { display: none; }
  :root[data-sidebar="collapsed"] .sb-head { padding: 0; justify-content: center; }
  :root[data-sidebar="collapsed"] .sb-links, :root[data-sidebar="collapsed"] .sb-foot { padding-left: 10px; padding-right: 10px; }
  :root[data-sidebar="collapsed"] .sb-section { display: block; height: 1px; padding: 0; margin: 12px 8px; background: var(--border); overflow: hidden; font-size: 0; }
  :root[data-sidebar="collapsed"] .sb-link { justify-content: center; padding: 0; height: 40px; }
  :root[data-sidebar="collapsed"] .sb-collapse svg { transform: scaleX(-1); }
  :root[data-sidebar="collapsed"] .sb-badges { position: absolute; top: 4px; right: 4px; gap: 2px; }
  :root[data-sidebar="collapsed"] .sb-count { min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; background: var(--accent); color: var(--accent-fg); box-shadow: 0 0 0 2px var(--surface); }
  :root[data-sidebar="collapsed"] .sb-count-accent, :root[data-sidebar="collapsed"] #sb-remotes-count { display: none; }
  :root[data-sidebar="collapsed"] #sb-hub-dot { position: absolute; top: 6px; right: 6px; }
}

/* ---------- page layout ---------- */
main {
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.page-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 16px; row-gap: 4px; align-items: center; }
.page-head > :not(.page-actions) { grid-column: 1; }
.page-title { font-size: var(--fs-xl); font-weight: 650; letter-spacing: -0.025em; margin: 0; line-height: 1.25; }
.page-sub { margin: 0; color: var(--muted); font-size: var(--fs-base); }
.page-actions { grid-column: 2; grid-row: 1 / span 2; display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.page-head + .tabs { margin-top: -8px; }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.col-primary, .col-secondary { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
@media (min-width: 1100px) {
  .layout { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (min-width: 1400px) {
  .layout { grid-template-columns: minmax(0, 1fr) 372px; }
}

/* ---------- cards ---------- */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}
.card-flush { box-shadow: none; }
.card-interactive { transition: border-color var(--dur-2) ease, box-shadow var(--dur-2) ease, transform var(--dur-2) var(--ease); }
.card-interactive:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); transform: translateY(-1px); text-decoration: none; }
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 20px;
  min-height: 56px;
  border-bottom: 1px solid var(--border);
}
.card-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.card-title { font-size: var(--fs-md); font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.card-desc { margin: 2px 0 0; font-size: var(--fs-sm); color: var(--muted); }
.card-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-body { padding: 20px; }
.card-body-tight { padding: 8px 0; }
.card-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: 0 0 var(--radius) var(--radius);
  font-size: var(--fs-sm);
  color: var(--muted);
}
.card-foot .spacer, .card-foot-start { margin-right: auto; }

/* ---------- badges ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 550;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--fg-2);
  font-variant-numeric: tabular-nums;
}
.badge-warn { color: var(--warn); border-color: transparent; background: var(--warn-bg); }
.badge-cors, .badge-accent { color: var(--accent); border-color: transparent; background: var(--accent-bg); }
.badge-up { color: var(--up); border-color: transparent; background: var(--up-bg); }
.badge-down { color: var(--down); border-color: transparent; background: var(--down-bg); }
.badge-muted { color: var(--muted); border-color: transparent; background: var(--surface-3); }
.badge-count { font-family: var(--mono); color: var(--muted); }
.badge-dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.badge-lg { height: 24px; padding: 0 10px; font-size: 12px; }
.badges { display: flex; flex-wrap: wrap; gap: 4px; }
td.badges { display: table-cell; }
td.badges .badge + .badge { margin-left: 4px; }

/* ---------- buttons ---------- */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 550;
  line-height: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
  user-select: none;
  -webkit-user-select: none;
  transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, color var(--dur-1) ease, opacity var(--dur-1) ease, box-shadow var(--dur-1) ease, transform var(--dur-1) var(--ease);
}
a.btn { text-decoration: none; }
.btn:hover:not(:disabled) { background: var(--surface-2); border-color: var(--muted-dim); text-decoration: none; }
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
.btn svg { width: 15px; height: 15px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.btn-secondary { background: var(--surface); }
.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 7px; }
.btn-lg { height: 40px; padding: 0 18px; font-size: 14px; border-radius: var(--radius-md); }
.btn-icon { width: 32px; padding: 0; }
.btn-sm.btn-icon { width: 28px; padding: 0; color: var(--muted); }
.btn-lg.btn-icon { width: 40px; }
.btn-icon svg { width: 16px; height: 16px; }
.btn-sm.btn-icon svg { width: 15px; height: 15px; }
.btn-icon.is-set { color: var(--accent); border-color: transparent; background: var(--accent-bg); }
.btn-block { width: 100%; }
.btn-primary { border-color: var(--accent); background: var(--accent); color: var(--accent-fg); box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12); }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-danger { border-color: var(--down-ring); color: var(--down); background: transparent; box-shadow: none; }
.btn-danger:hover:not(:disabled) { background: var(--down-bg); border-color: var(--down); }
.btn-danger-solid, .modal-foot .btn-danger { background: var(--down); border-color: var(--down); color: #fff; }
.btn-danger-solid:hover:not(:disabled), .modal-foot .btn-danger:hover:not(:disabled) { background: var(--down); border-color: var(--down); filter: brightness(0.92); }
.btn-ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--muted); }
.btn-ghost:hover:not(:disabled) { background: var(--nav-active); border-color: transparent; color: var(--fg); }
.btn-ghost[aria-expanded="true"] { background: var(--nav-active); color: var(--fg); }
.btn-ghost-danger { background: transparent; border-color: transparent; box-shadow: none; color: var(--muted); }
.btn-ghost-danger:hover:not(:disabled) { color: var(--down); background: var(--down-bg); border-color: transparent; }
.btn-more { color: var(--muted); }
.btn-more svg { fill: currentColor; stroke: none; }
.row-actions { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
.row-actions .btn-danger:not(:hover):not(:focus-visible) { border-color: var(--border-strong); color: var(--muted); }
.btn-group { display: inline-flex; }
.btn-group > .btn { border-radius: 0; }
.btn-group > .btn:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
.btn-group > .btn:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.btn-group > .btn + .btn { margin-left: -1px; }
.btn.busy { opacity: 0.7; cursor: wait; }
.btn.busy, #ca-toggle.busy, #startup-toggle.busy { color: transparent !important; pointer-events: none; }
.btn.busy svg { opacity: 0; }
.btn.busy::after {
  content: "";
  position: absolute;
  width: 13px; height: 13px;
  top: 50%; left: 50%;
  margin: -6.5px 0 0 -6.5px;
  border-radius: 50%;
  border: 2px solid rgba(127, 127, 127, 0.35);
  border-top-color: var(--accent-strong);
  animation: spin 0.7s linear infinite;
}
.btn-primary.busy::after { border-color: rgba(255, 255, 255, 0.35); border-top-color: #fff; }
.copy-btn {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 550;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--dur-1) ease, border-color var(--dur-1) ease, background-color var(--dur-1) ease;
}
.copy-btn:hover { color: var(--fg); border-color: var(--muted-dim); }
.copy-btn:active { background: var(--surface-2); }

/* ---------- switch ---------- */
.switch {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--border-strong);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background-color var(--dur-2) ease, box-shadow var(--dur-2) ease;
}
.switch::before { content: ""; position: absolute; inset: -11px -4px; }
.switch:hover:not(:disabled) { box-shadow: 0 0 0 4px var(--nav-active); }
.switch .switch-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform var(--dur-2) var(--ease), opacity var(--dur-1) ease;
}
.switch:active:not(:disabled) .switch-knob { transform: scaleX(1.15); }
.switch.on { background: var(--accent); }
.switch.on .switch-knob { transform: translateX(16px); }
.switch.on:active:not(:disabled) .switch-knob { transform: translateX(14px) scaleX(1.15); }
.switch.busy { opacity: 0.6; cursor: wait; }
.switch:disabled { cursor: not-allowed; opacity: 0.5; }
.switch.busy .switch-knob { opacity: 0; }
.switch.busy::after {
  content: "";
  position: absolute;
  top: 3px; left: 11px;
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}
body.offline .switch, body.offline #add-submit { opacity: 0.5; pointer-events: none; }

/* ---------- inputs ---------- */
.input, .field input[type="text"], .field input[type="password"], .field input[type="number"], .field input[type="url"], .edit-input, textarea.input {
  height: 36px;
  width: 100%;
  padding: 0 12px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--dur-1) ease, box-shadow var(--dur-1) ease;
}
textarea.input { height: auto; min-height: 80px; padding: 8px 12px; line-height: 1.5; resize: vertical; }
.input:hover:not(:disabled):not(:focus), .field input:hover:not(:disabled):not(:focus) { border-color: var(--muted-dim); }
.input::placeholder, .field input::placeholder { color: var(--muted-dim); }
.input:focus-visible, .field input[type="text"]:focus-visible, .field input[type="password"]:focus-visible, .field input[type="number"]:focus-visible, .field input[type="url"]:focus-visible, .edit-input:focus-visible, textarea.input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring);
}
.input:disabled { opacity: 0.6; cursor: not-allowed; background: var(--surface-2); }
.input-sm { height: 30px; font-size: 12px; padding: 0 10px; font-family: var(--sans); }
.input-search { width: 200px; max-width: 100%; }
.field input.invalid, .edit-input.invalid, .input.invalid { border-color: var(--down); }
.field input.invalid:focus-visible, .edit-input.invalid:focus-visible, .input.invalid:focus-visible { box-shadow: 0 0 0 3px var(--down-ring); }
.edit-input { height: 30px; min-width: 0; padding: 0 10px; }
input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 16px; height: 16px;
  margin: 0;
  flex-shrink: 0;
  border: 1.5px solid var(--border-strong);
  border-radius: 4.5px;
  background: var(--surface);
  cursor: pointer;
  transition: background-color var(--dur-1) ease, border-color var(--dur-1) ease, box-shadow var(--dur-1) ease;
}
input[type="checkbox"]:hover:not(:disabled) { border-color: var(--muted); }
input[type="checkbox"]:checked { background: var(--accent); border-color: var(--accent); }
input[type="checkbox"]::after {
  content: "";
  position: absolute;
  left: 4.5px; top: 1.5px;
  width: 4px; height: 8px;
  border: solid var(--accent-fg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform var(--dur-1) var(--ease);
}
input[type="checkbox"]:checked::after { transform: rotate(45deg) scale(1); }
input[type="checkbox"]:focus-visible { outline: none; box-shadow: var(--ring); border-color: var(--accent); }
input[type="checkbox"]:disabled { opacity: 0.5; cursor: not-allowed; }
input[type="radio"] { accent-color: var(--accent); width: 16px; height: 16px; margin: 0; }
select.input, .field select {
  height: 36px;
  width: 100%;
  padding: 0 30px 0 12px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--fg);
  background-color: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) center, calc(100% - 11px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  transition: border-color var(--dur-1) ease, box-shadow var(--dur-1) ease;
}
select.input:focus-visible, .field select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--ring);
}
select.input-sm { height: 28px; font-size: 12px; padding: 0 24px 0 8px; background-position: calc(100% - 13px) center, calc(100% - 8px) center; }
.field-hint { font-size: 12px; color: var(--muted); margin: 0; }
.check-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, box-shadow var(--dur-1) ease;
}
.check-card:hover { border-color: var(--border-strong); }
.check-card input { margin-top: 2px; }
.check-card:has(input:checked) { border-color: var(--accent); background: var(--accent-bg); }
.check-card:has(input:focus-visible) { box-shadow: var(--ring); }
.check-card:has(input:disabled) { opacity: 0.6; cursor: not-allowed; }
.check-card-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.check-card-title { font-size: 13.5px; font-weight: 550; color: var(--fg); }
.check-card-desc { font-size: var(--fs-sm); color: var(--muted); line-height: 1.45; }
.check-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
/* ---------- add host form ---------- */
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field label { font-size: 12.5px; color: var(--fg-2); font-weight: 500; }
.form-checks { display: flex; flex-wrap: wrap; gap: 8px 18px; padding-top: 2px; }
.field-checkbox { flex-direction: row; align-items: center; gap: 8px; }
.field-checkbox label { font-size: 13px; color: var(--fg-2); font-weight: 400; cursor: pointer; }
.field-error {
  font-size: 13px;
  color: var(--down);
  background: var(--down-bg);
  border: 1px solid var(--down);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* ---------- system list ---------- */
.stat-list { display: flex; flex-direction: column; }
.stat-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.stat-row:last-child { border-bottom: none; }
.stat-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.stat-side { flex-shrink: 0; padding-top: 2px; }
.tile-value { font-size: 14px; font-weight: 600; color: var(--fg); }
.tile-value.ok { color: var(--up); }
.tile-value.warn { color: var(--warn); }
.tile-sub { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.tile-sub.mono { font-size: 11.5px; }
.tile-hint { font-size: 12px; color: var(--warn); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.tile-hint code { overflow-wrap: anywhere; }
.tile-actions { margin-top: 10px; }

/* ---------- hosts table ---------- */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th, td {
  text-align: left;
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  white-space: nowrap;
  vertical-align: middle;
}
th:first-child, td:first-child { padding-left: 20px; }
th:last-child, td:last-child { padding-right: 20px; }
th {
  color: var(--muted);
  font-weight: 500;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--surface-2);
  padding-top: 9px;
  padding-bottom: 9px;
}
th.num, td.num { text-align: right; }
th.actions { text-align: right; }
tbody tr { transition: background 0.15s ease; }
tbody tr:hover { background: var(--surface-2); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:last-child td:first-child { border-bottom-left-radius: var(--radius); }
tbody tr:last-child td:last-child { border-bottom-right-radius: var(--radius); }
#table th:nth-child(2), #table td.arrow { display: none; }
#table tbody td { padding-top: 10px; padding-bottom: 10px; }
.host-cell { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.host-cell a { color: var(--fg); }
.host-cell a:hover { color: var(--accent); }
.host-target, .traffic { font-size: 12px; color: var(--muted); margin-top: 3px; font-family: var(--mono); }
.host-target { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.host-td .edit-input { margin-top: 6px; width: 100%; min-width: 150px; }
.host-cell .copy-btn, .tunnel-status .copy-btn { opacity: 0; transition: opacity 0.12s ease; }
tbody tr:hover .copy-btn, .copy-btn:focus-visible, #table tbody td:hover .copy-btn { opacity: 1; }
tr.row-down td:first-child { box-shadow: inset 3px 0 0 var(--down); }
.pill { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 12px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--muted-dim); }
.dot.up { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.dot.down { background: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
.dot.warn { background: var(--warn); box-shadow: 0 0 0 3px var(--warn-bg); }
.dot.accent { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.edit-hint { font-size: 12px; }
td.edit-error { color: var(--down); white-space: normal; }
td .inline-check + .inline-check { margin-top: 4px; }
.inline-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.tunnel-cell { white-space: normal; }
.tunnel-status { display: flex; align-items: center; gap: 6px; max-width: 240px; }
.tunnel-login { display: flex; flex-direction: column; gap: 2px; font-size: 12px; white-space: nowrap; }
.tunnel-login a { font-weight: 500; }
.tunnel-status a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; display: inline-block; vertical-align: middle; font-size: 12px; }
.tunnel-error { color: var(--down); cursor: help; }
.tunnel-error-text {
  color: var(--down);
  cursor: help;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
  display: inline-block;
  vertical-align: middle;
  font-size: 12px;
}
.spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty {
  padding: 40px 24px;
  color: var(--muted);
  text-align: center;
  font-size: 13.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty p { margin: 0; }
.empty-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-dim);
  font-size: 18px;
}
#hosts-error .empty-icon { color: var(--down); border-color: var(--down); background: var(--down-bg); }
.empty pre { display: inline-block; text-align: left; }

pre.code-block {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg-2);
  margin: 0;
}
.cli-list { display: flex; flex-direction: column; gap: 16px; }
.cli-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cli-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* ---------- remote access ---------- */
.hub-section { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.hub-section:first-child { border-top: none; }
.hub-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hub-url { font-family: var(--mono); font-size: 12.5px; word-break: break-all; color: var(--fg-2); }
.hub-warn { font-size: 12px; color: var(--warn); background: var(--warn-bg); border-radius: var(--radius-sm); padding: 6px 10px; }
.hub-actions, .invite-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hub-form-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.hub-form-row .field { flex: 1; min-width: 140px; }
.invite-result { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.invite-result-row { display: flex; align-items: center; gap: 8px; }
.invite-string { font-family: var(--mono); font-size: 11.5px; word-break: break-all; flex: 1; min-width: 0; }
.invite-countdown { font-family: var(--mono); font-size: 12px; color: var(--muted); white-space: nowrap; }
.host-checks { display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; }
.host-checks[hidden] { display: none; }
.host-checks label { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fg-2); cursor: pointer; }
.peer-list, .invite-list, .remote-list { display: flex; flex-direction: column; }
.remote-list:not(:empty) { padding: 0 20px 12px; }
.peer-row, .invite-row, .remote-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.peer-row:last-child, .invite-row:last-child, .remote-item:last-child { border-bottom: none; }
.peer-main, .remote-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.peer-name { font-weight: 500; font-size: 13px; }
.peer-controls, .remote-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.remote-item { flex-direction: column; align-items: stretch; }
.remote-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.remote-hosts-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.remote-host-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 0; border-top: 1px solid var(--border); }
.remote-host-row:first-child { border-top: none; }
.badge-role { text-transform: capitalize; }
.remote-card-body { display: flex; flex-direction: column; gap: 14px; }
.mini-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.mini-form input { flex: 1; min-width: 90px; }
.host-cell .badge-via { margin-left: 4px; }

/* ---------- banners ---------- */
.banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 13.5px;
  border: 1px solid var(--down);
  background: var(--down-bg);
  color: var(--fg);
}
.banner-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.banner .btn { background: var(--surface); }

/* ---------- logs ---------- */
details.card summary {
  cursor: pointer;
  list-style: none;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: var(--radius);
}
details.card summary::-webkit-details-marker { display: none; }
details.card summary .card-title { display: flex; align-items: center; gap: 8px; }
details.card summary .card-title::before {
  content: "";
  width: 6px; height: 6px;
  border-right: 1.5px solid var(--muted);
  border-bottom: 1.5px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
  margin-right: 2px;
}
details.card[open] summary .card-title::before { transform: rotate(45deg); }
details.card[open] summary { border-bottom: 1px solid var(--border); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.logs-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.logs-actions { display: flex; gap: 8px; }
.logs-box {
  height: 280px;
  overflow-y: auto;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg-2);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

/* ---------- dialogs (all <dialog>s; bottom sheets on <=640px) ---------- */
dialog {
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  color: var(--fg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
dialog[open] { display: flex; flex-direction: column; animation: dlg-in var(--dur-3) var(--ease); }
dialog::backdrop { background: var(--overlay); }
dialog[open]::backdrop { animation: fade-in var(--dur-3) var(--ease); }
dialog.closing { animation: dlg-out 150ms var(--ease-in) forwards; pointer-events: none; }
dialog.closing::backdrop { animation: fade-out 150ms var(--ease-in) forwards; }
@keyframes dlg-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes dlg-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(4px) scale(0.98); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
#allow-dialog { width: min(520px, calc(100vw - 32px)); }
.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.modal-head > div { min-width: 0; }
.modal-title { font-size: 16px; font-weight: 650; margin: 0; letter-spacing: -0.015em; line-height: 1.35; }
.modal-sub { margin: 3px 0 0; font-size: var(--fs-sm); color: var(--muted); overflow-wrap: anywhere; }
.modal-close { width: 30px; height: 30px; padding: 0; border-radius: var(--radius-full); flex-shrink: 0; margin: -4px -6px 0 0; }
.modal-close svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; overscroll-behavior: contain; flex: 1 1 auto; min-height: 0; }
.modal-desc { margin: 0; font-size: 13.5px; color: var(--muted); line-height: 1.55; }
.modal-warn {
  font-size: var(--fs-sm);
  color: var(--warn);
  background: var(--warn-bg);
  border: 1px solid color-mix(in srgb, var(--warn) 40%, transparent);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  line-height: 1.5;
}
.allow-list { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
.allow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.allow-row span { font-size: 13px; word-break: break-all; }
.allow-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  border-radius: var(--radius-xs);
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}
.allow-remove:hover { color: var(--down); background: var(--down-bg); border-color: transparent; }
.allow-empty { font-size: 13px; padding: 4px 0; }
.allow-add-row { display: flex; gap: 8px; }
.allow-add-row .input { flex: 1; }
.allow-add-row .btn { height: auto; align-self: stretch; padding: 0 14px; }
.modal-hint { margin: 0; font-size: 12px; color: var(--muted-dim); }
.modal-foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  flex-shrink: 0;
}
#confirm-dialog, #prompt-dialog { width: min(420px, calc(100vw - 32px)); }
#share-dialog, #protect-dialog { width: min(480px, calc(100vw - 32px)); }
#confirm-dialog .modal-head { border-bottom: 0; padding-bottom: 0; }
#confirm-dialog .modal-body { padding-top: 8px; }
.field-password { position: relative; }
.field-password .input { width: 100%; padding-right: 40px; }
.field-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.field-toggle:hover { background: var(--surface-2); color: var(--fg); }
.field-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.option-check {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  position: relative;
}
.option-card[aria-checked="true"] .option-check { border-color: var(--accent); background: var(--accent); }
.option-card[aria-checked="true"] .option-check::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid var(--accent-fg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
#protect-remove { margin-right: auto; }
.share-options { display: flex; flex-direction: column; gap: 10px; }
.option-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.option-card:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.option-card[aria-checked="true"] { border-color: var(--accent); background: var(--accent-bg); }
.option-dot {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  position: relative;
}
.option-card[aria-checked="true"] .option-dot { border-color: var(--accent); }
.option-card[aria-checked="true"] .option-dot::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}
.option-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.option-title { font-size: 13.5px; font-weight: 600; }
.option-desc { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.option-extra { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.option-extra .field-error { margin-top: 4px; }
.share-progress { display: flex; gap: 14px; align-items: flex-start; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); }
.share-progress-icon { width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; display: grid; place-items: center; background: var(--accent-bg); color: var(--accent); }
.share-progress-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.share-progress-icon .spinner { margin: 0; }
.share-progress-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.share-progress-title { font-size: 14px; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
.share-progress-text { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0; }
.share-progress-body .btn { align-self: flex-start; margin-top: 6px; text-decoration: none; }
.share-steps { margin: 2px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); line-height: 1.6; }

/* ---------- toasts ---------- */
.toast-container {
  position: fixed;
  inset: auto 20px 20px auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 380px;
  max-width: calc(100vw - 24px);
  pointer-events: none;
}
.toast-container:empty { display: none; }
.toast {
  position: relative;
  pointer-events: auto;
  width: 100%;
  background: var(--surface-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px 12px 38px;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: var(--shadow-lg);
  overflow-wrap: anywhere;
  opacity: 0;
  transform: translateY(10px) scale(0.97);
  transition: opacity var(--dur-2) var(--ease), transform var(--dur-3) var(--ease);
}
.toast::before {
  content: "";
  position: absolute;
  left: 14px; top: 15px;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-bg);
}
.toast.show { opacity: 1; transform: none; }
.toast-success::before { background: var(--up); box-shadow: 0 0 0 4px var(--up-bg); }
.toast-error::before { background: var(--down); box-shadow: 0 0 0 4px var(--down-bg); }
.toast-warn::before { background: var(--warn); box-shadow: 0 0 0 4px var(--warn-bg); }
.toast-error { border-color: var(--down-ring); }
.toast-hint { margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toast-hint code { font-size: 11.5px; color: var(--fg-2); background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); padding: 2px 6px; }

/* ---------- skeleton / boot ---------- */
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
body.boot .tile-value,
body.boot .tile-sub,
body.boot #version,
body.boot #uptime,
body.boot #pid,
.skel-bar, .skel-line, .skel-circle, .skel-block {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 37%, var(--surface-2) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}
body.boot .tile-value,
body.boot .tile-sub,
body.boot #version,
body.boot #uptime,
body.boot #pid {
  color: transparent !important;
  display: inline-block;
  min-width: 70px;
  border-radius: 4px;
  border-color: transparent;
}
body.boot #updated { visibility: hidden; }
body.boot #stop-proxy-btn, body.offline #stop-proxy-btn { display: none; }
.skel-bar { display: block; width: 80%; height: 14px; border-radius: 4px; }
.skel-line { display: block; width: 100%; height: 12px; border-radius: 4px; }
.skel-line + .skel-line { margin-top: 8px; }
.skel-line.short { width: 40%; }
.skel-circle { display: inline-block; width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; }
.skel-block { display: block; width: 100%; height: 72px; border-radius: var(--radius); }
#hosts-skeleton table { min-width: 0; }
.skeleton-row td { border-bottom: 1px solid var(--border); padding: 17px 20px; }
.skeleton-row:nth-child(1) .skel-bar { width: 92%; }
.skeleton-row:nth-child(2) .skel-bar { width: 70%; }
.skeleton-row:nth-child(3) .skel-bar { width: 82%; }

footer { text-align: center; padding: 8px 20px 32px; color: var(--muted-dim); font-size: 12px; }
footer a { color: var(--muted); }
[hidden] { display: none !important; }

/* ---------- pages ---------- */
.view { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (min-width: 1100px) { .tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); color: var(--fg); min-width: 0; transition: border-color 0.15s ease; }
.tile:hover { border-color: var(--border-strong); text-decoration: none; }
.tile-big { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
.tile-big.tile-word { font-size: 18px; line-height: 1.8; }
.tile-big.ok { color: var(--up); }
.tile-big.bad { color: var(--down); }
.tile-big.warn { color: var(--warn); }
.tile .tile-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grid-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
@media (min-width: 1000px) { .grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.ov-list { display: flex; flex-direction: column; }
.ov-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); min-width: 0; }
.ov-row:last-child { border-bottom: none; }
.ov-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ov-title { font-family: var(--mono); font-size: 13px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ov-checks .ov-title { font-family: var(--sans); }
.ov-sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; font-size: 12px; color: var(--muted); }
.ov-side a.ov-link { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); }
.ov-more { padding: 10px 20px; font-size: 12.5px; }
.logs-full { height: calc(100vh - 290px); min-height: 320px; max-height: none; margin: 0; border-radius: 0; border: 0; border-top: 1px solid var(--border); }
.logs-short { height: auto; max-height: 220px; margin: 0; border-radius: 0 0 var(--radius) var(--radius); border: 0; }
.logs-head { flex-wrap: wrap; gap: 10px; }
.logs-tools { flex-wrap: wrap; gap: 8px; flex: 1; min-width: 0; }
.logs-tools .input { width: auto; }
.logs-tools select.input { padding-right: 28px; }
.logs-tools .input-search { width: 220px; }
.logs-meta { padding: 8px 20px; font-size: 12px; border-top: 1px solid var(--border); }
.check-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--fg-2); cursor: pointer; }
select.input { padding-right: 8px; cursor: pointer; }
.segmented { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.segmented button { border: 0; background: var(--surface); color: var(--muted); font-size: 12.5px; padding: 6px 12px; cursor: pointer; }
.segmented button + button { border-left: 1px solid var(--border); }
.segmented button[aria-checked="true"] { background: var(--accent-bg); color: var(--accent-strong); font-weight: 600; }
.form-row-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 10px; }
.form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
#ports-form .hub-warn { margin-top: 12px; }
.token-body { display: flex; flex-direction: column; gap: 12px; }
.token-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.token-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; padding: 6px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); }
.help-list { display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--fg-2); }
.help-list p { margin: 0; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.remote-local { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.remote-local a { font-family: var(--mono); font-size: 13px; }
.role-table { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.role-table div { display: flex; gap: 10px; padding: 8px 12px; font-size: 12.5px; }
.role-table div + div { border-top: 1px solid var(--border); }
.role-table strong { width: 56px; flex-shrink: 0; }
.role-table span { color: var(--muted); }
.danger-card { border-color: var(--down-bg); }
.danger-card .card-title { color: var(--down); }
.sb-dot { margin-left: auto; }
input.input[type="number"] { font-family: var(--mono); }

/* ---------- responsive ---------- */
@media (min-width: 1200px) {
  th, td { padding-left: 10px; padding-right: 10px; }
  .tunnel-status .copy-btn { display: none; }
  .tunnel-status a { max-width: 150px; }
  .host-target { max-width: 200px; }
}
@media (min-width: 1200px) and (max-width: 1399px) {
  .tunnel-status a { max-width: 110px; }
  .host-target { max-width: 170px; }
}
@media (max-width: 1099px) {
  .topbar, main { padding-left: 24px; padding-right: 24px; }
}
@media (min-width: 700px) and (max-width: 1099px) {
  .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 641px) and (max-width: 899px), (min-width: 1100px) and (max-width: 1279px) {
  #table tbody { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #table tbody tr:nth-child(odd) { border-right: 1px solid var(--border); }
  #table tbody tr:nth-last-child(2):nth-child(odd) { border-bottom: none; }
}
@media (max-width: 899px), (min-width: 1100px) and (max-width: 1279px) {
  #table { min-width: 0; }
  #table thead { display: none; }
  #table, #table tbody, #table tr { display: block; width: 100%; }
  #table tr { padding: 14px 20px; border-bottom: 1px solid var(--border); }
  #table tr:last-child { border-bottom: none; }
  #table td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border: none; white-space: normal; text-align: right; min-width: 0; }
  #table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; flex-shrink: 0; text-align: left; }
  #table td[data-label=""]::before { content: none; }
  #table td[data-label=""]:first-child { padding-bottom: 8px; justify-content: flex-start; font-weight: 600; }
  #table td.host-td, #table td.status-td { flex-direction: column; align-items: flex-start; gap: 0; }
  #table td.status-td { align-items: flex-end; }
  #table td.status-td::before { align-self: flex-start; margin-bottom: 4px; }
  #table td.host-td .edit-input { margin-top: 8px; }
  .host-target { max-width: 100%; }
  .host-cell .copy-btn, .tunnel-status .copy-btn { opacity: 1; }
  #table td[data-label=""] { justify-content: flex-end; padding-top: 10px; }
  #table .edit-input { min-width: 0; }
  tr.row-down td:first-child { box-shadow: none; }
  tr.row-down { box-shadow: inset 3px 0 0 var(--down); }
  .tunnel-status, .tunnel-status a, .tunnel-error-text { max-width: 100%; min-width: 0; }
  .tunnel-status { justify-content: flex-end; flex: 0 1 auto; }
  .tunnel-status a { flex: 0 1 auto; }
}
/* ---------- empty states ---------- */
.empty {
  padding: 44px 24px;
  color: var(--muted);
  text-align: center;
  font-size: 13.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.empty p, .empty-desc { margin: 0; max-width: 420px; line-height: 1.55; }
.empty-icon {
  width: 44px; height: 44px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), var(--surface-2));
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 18px;
  margin-bottom: 4px;
}
.empty-icon svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.empty-title { margin: 0; font-size: var(--fs-md); font-weight: 600; color: var(--fg); }
.empty-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px; }

/* ---------- banners ---------- */
.banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 13.5px;
  border: 1px solid var(--down-ring);
  background: var(--down-bg);
  color: var(--fg);
  animation: rise-in var(--dur-3) var(--ease);
}

/* ---------- option cards / tiles polish ---------- */
.option-card { transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease, box-shadow var(--dur-1) ease; }
.option-card:hover:not([aria-checked="true"]) { border-color: var(--border-strong); }
.option-check, .option-dot { transition: border-color var(--dur-1) ease, background-color var(--dur-1) ease; }
.tile { transition: border-color var(--dur-2) ease, box-shadow var(--dur-2) ease, transform var(--dur-2) var(--ease); }
a.tile:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
a.tile:active { transform: none; }
.segmented { background: var(--surface-2); padding: 2px; gap: 2px; border-radius: var(--radius-sm); }
.segmented button { border-radius: 6px; background: transparent; transition: background-color var(--dur-1) ease, color var(--dur-1) ease; }
.segmented button + button { border-left: 0; }
.segmented button:hover { color: var(--fg); }
.segmented button[aria-checked="true"] { background: var(--surface); color: var(--fg); box-shadow: var(--shadow-xs); }

/* ---------- tabs ---------- */
.tabs {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 2px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  flex-shrink: 0;
}
.tabs::-webkit-scrollbar { display: none; }
.tabs [role="tab"] {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  margin-bottom: -1px;
  border: 0;
  background: none;
  color: var(--muted);
  font: 550 13.5px var(--sans);
  white-space: nowrap;
  cursor: pointer;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: color var(--dur-1) ease;
}
.tabs [role="tab"]::after { content: ""; position: absolute; inset: 6px 2px; border-radius: var(--radius-sm); background: var(--nav-active); opacity: 0; transition: opacity var(--dur-1) ease; z-index: -1; }
.tabs [role="tab"]:hover { color: var(--fg); }
.tabs [role="tab"]:hover::after { opacity: 1; }
.tabs [role="tab"][aria-selected="true"] { color: var(--fg); }
.tabs [role="tab"]:focus-visible { outline-offset: -4px; }
.tabs [role="tab"] svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tabs [role="tab"] .badge, .tabs [role="tab"] .tab-count { height: 18px; padding: 0 6px; font-size: 10.5px; }
.tabs { isolation: isolate; }
.tabs-ink {
  position: absolute;
  left: 0; bottom: 0;
  width: 1px;
  height: 2px;
  border-radius: 2px;
  background: var(--fg);
  transform-origin: 0 0;
  pointer-events: none;
  opacity: 0;
}
.tabs.ink-ready .tabs-ink { opacity: 1; transition: transform var(--dur-3) var(--ease); }
.tabs.ink-ready.ink-moving .tabs-ink { transition: transform var(--dur-3) var(--ease), opacity var(--dur-1) ease; }
[role="tabpanel"]:not([hidden]) { animation: panel-in var(--dur-2) var(--ease); }
[role="tabpanel"]:focus-visible { outline-offset: 4px; }
.tab-panels { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
[data-tab-panel] { min-width: 0; }
[data-tab-panel]:not([hidden]) { display: flex; flex-direction: column; gap: 24px; }

/* ---------- menus (openMenu) ---------- */
.menu {
  position: fixed;
  inset: auto;
  z-index: 85;
  margin: 0;
  min-width: 200px;
  max-width: min(320px, calc(100vw - 16px));
  max-height: min(420px, calc(100vh - 16px));
  overflow-y: auto;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--fg);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  transform-origin: top right;
  animation: menu-in var(--dur-2) var(--ease);
}
.menu:focus { outline: none; }
.menu.menu-up { transform-origin: bottom right; animation-name: menu-in-up; }
.menu.menu-start { transform-origin: top left; }
.menu.menu-up.menu-start { transform-origin: bottom left; }
.menu.menu-closing { animation: menu-out 120ms var(--ease-in) forwards; pointer-events: none; }
@keyframes menu-in { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes menu-in-up { from { opacity: 0; transform: translateY(4px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes menu-out { to { opacity: 0; transform: scale(0.98); } }
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--fg);
  font: 500 13px var(--sans);
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover:not(:disabled), .menu-item:focus-visible { background: var(--nav-active); outline: none; }
.menu-item:active:not(:disabled) { background: var(--surface-3); }
.menu-item:disabled { color: var(--muted-dim); cursor: not-allowed; }
.menu-item.danger { color: var(--down); }
.menu-item.danger:hover:not(:disabled), .menu-item.danger:focus-visible { background: var(--down-bg); }
.menu-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--muted); fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.menu-item.danger .menu-icon { color: currentColor; }
.menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.menu-hint { margin-left: auto; padding-left: 12px; color: var(--muted); font-size: 12px; font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; }
.menu-sep { height: 1px; margin: 5px -5px; background: var(--border); }
.menu-info { display: flex; align-items: center; gap: 10px; min-height: 30px; padding: 0 10px; color: var(--muted); font-size: 12.5px; white-space: nowrap; }
.menu-info .menu-hint { color: var(--fg-2); max-width: 200px; }
.menu-title { padding: 8px 10px 6px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0.02em; }
.menu-cancel { display: none; }

/* ---------- tooltips ---------- */
.tooltip {
  position: fixed;
  z-index: 95;
  top: 0; left: 0;
  max-width: 260px;
  padding: 5px 9px;
  border-radius: var(--radius-xs);
  background: var(--tooltip-bg);
  color: var(--tooltip-fg);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--dur-1) ease;
  box-shadow: var(--shadow-md);
}
.tooltip.show { opacity: 1; }

/* ---------- motion ---------- */
@keyframes rise-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes panel-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.view:not([hidden]) { animation: rise-in var(--dur-3) var(--ease); }
.anim-in, .anim-list > * { animation: rise-in var(--dur-2) var(--ease) both; }
.anim-list > :nth-child(2) { animation-delay: 30ms; }
.anim-list > :nth-child(3) { animation-delay: 60ms; }
.anim-list > :nth-child(4) { animation-delay: 90ms; }
.anim-list > :nth-child(5) { animation-delay: 120ms; }
.anim-list > :nth-child(n+6) { animation-delay: 150ms; }

/* ---------- tablet (icon rail by default) ---------- */
@media (min-width: 641px) and (max-width: 1099px) {
  .topbar, main { padding-left: 24px; padding-right: 24px; }
  #pid, .status-pid-sep, #updated { display: none; }
}

/* ---------- mobile: compact top bar + bottom tab bar + sheets ---------- */
@media (max-width: 640px) {
  :root, :root[data-sidebar="collapsed"] { --sb-w: 0px; --topbar-h: 52px; }
  .shell { padding-bottom: calc(var(--bottombar-h) + var(--safe-b)); }
  .topbar { padding: 0 12px 0 16px; }
  .crumbs, #updated, .status-extra, #version { display: none; }
  .brand-mobile { display: inline-block; }
  span.wordmark.brand-mobile { display: inline; }
  .status-pill { height: 36px; padding: 0 10px 0 12px; }
  .btn.theme-toggle { width: 36px; height: 36px; }
  main { padding: 20px 16px 32px; gap: 20px; }
  footer { padding-bottom: 20px; }

  .sidebar {
    top: auto; right: 0; bottom: 0; left: 0;
    width: auto;
    height: calc(var(--bottombar-h) + var(--safe-b));
    padding-bottom: var(--safe-b);
    flex-direction: row;
    border-right: 0;
    border-top: 1px solid var(--border);
    z-index: 8;
    overflow: visible;
  }
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .sidebar {
      background: color-mix(in srgb, var(--surface) 86%, transparent);
      -webkit-backdrop-filter: saturate(180%) blur(14px);
      backdrop-filter: saturate(180%) blur(14px);
    }
  }
  .sb-head, .sb-section, .sb-foot { display: none; }
  .sb-links { flex-direction: row; align-items: stretch; flex: 1; padding: 0 4px; gap: 0; overflow: visible; }
  .sb-group { display: contents; }
  .sb-link {
    flex: 1 1 0;
    min-width: 0;
    height: var(--bottombar-h);
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding: 0 2px;
    border-radius: 0;
    font-size: 11px;
    font-weight: 550;
    letter-spacing: 0.01em;
    background: none !important;
  }
  .sb-link .sb-label { display: block; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .sb-link svg { width: 22px; height: 22px; }
  .sb-link::before {
    content: "";
    position: absolute;
    top: 7px; left: 50%;
    width: 52px; height: 28px;
    margin-left: -26px;
    border-radius: var(--radius-full);
    background: var(--accent-bg);
    opacity: 0;
    transform: scaleX(0.5);
    transition: opacity var(--dur-2) ease, transform var(--dur-2) var(--ease);
  }
  .sb-link[aria-current] { color: var(--accent); }
  .sb-link[aria-current]::before { opacity: 1; transform: none; }
  .sb-link:active svg { transform: scale(0.9); }
  .sb-badges { position: absolute; top: 4px; left: calc(50% + 6px); margin: 0; gap: 2px; z-index: 2; }
  .sb-count { min-width: 17px; height: 17px; padding: 0 4px; font-size: 10px; background: var(--accent); color: var(--accent-fg); box-shadow: 0 0 0 2px var(--surface); }
  .sb-count-accent, #sb-remotes-count { display: none; }
  #sb-hub-dot { box-shadow: 0 0 0 2px var(--surface); margin-top: 3px; }

  .page-head { grid-template-columns: minmax(0, 1fr); }
  .page-actions { grid-column: 1; grid-row: auto; justify-content: flex-start; margin-top: 8px; }
  .page-title { font-size: 20px; }
  .tabs { margin-left: -16px; margin-right: -16px; padding: 0 12px; }
  .tabs [role="tab"] { height: 44px; }
  .col-primary, .col-secondary, .layout { gap: 16px; }
  .card-head, .card-body, .card-foot, .stat-row, .logs-body, details.card summary { padding-left: 16px; padding-right: 16px; }
  #table tr { padding-left: 16px; padding-right: 16px; }
  .skeleton-row td { padding-left: 16px; padding-right: 16px; }
  .input-search { width: 100%; }
  .card-tools { width: 100%; }
  .row-actions { flex-wrap: wrap; }
  .input, select.input, .field input[type="text"], .field input[type="password"] { font-size: 16px; }
  .input-sm, select.input-sm { font-size: 14px; }

  .toast-container { inset: auto 12px calc(var(--bottombar-h) + var(--safe-b) + 12px) 12px; width: auto; max-width: none; align-items: stretch; }
  .toast { transform: translateY(16px); }
  body:has(dialog[open]) .toast-container { inset: calc(12px + env(safe-area-inset-top, 0px)) 12px auto 12px; flex-direction: column-reverse; }
  body:has(dialog[open]) .toast { transform: translateY(-16px); }
  body:has(dialog[open]) .toast.show { transform: none; }

  dialog, #allow-dialog, #confirm-dialog, #prompt-dialog, #share-dialog, #protect-dialog {
    width: 100%;
    max-width: 100%;
    max-height: 92vh;
    max-height: 92dvh;
    margin: auto 0 0;
    border-radius: 18px 18px 0 0;
    border-bottom: 0;
  }
  dialog[open] { animation: sheet-in var(--dur-3) var(--ease); }
  dialog.closing { animation: sheet-out 180ms var(--ease-in) forwards; }
  dialog .modal-head { padding-top: 22px; position: relative; }
  dialog .modal-head::before { content: ""; position: absolute; top: 8px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 4px; background: var(--border-strong); }
  .modal-foot { padding-bottom: calc(14px + var(--safe-b)); }
  .modal-foot .btn { flex: 1 1 0; height: 42px; }

  .menu.menu-sheet {
    inset: auto 0 0 0;
    width: 100%;
    max-width: 100%;
    max-height: 80vh;
    padding: 20px 8px calc(8px + var(--safe-b));
    border-radius: 18px 18px 0 0;
    border-bottom: 0;
    box-shadow: 0 0 0 100vmax var(--overlay), var(--shadow-lg);
    animation: sheet-in var(--dur-3) var(--ease);
    font-size: 15px;
  }
  .menu.menu-sheet::before { content: ""; position: absolute; top: 8px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 4px; background: var(--border-strong); }
  .menu.menu-sheet.menu-closing { animation: sheet-out 180ms var(--ease-in) forwards; }
  .menu-sheet .menu-item { min-height: 48px; font-size: 15px; padding: 0 14px; border-radius: var(--radius-md); }
  .menu-sheet .menu-icon { width: 20px; height: 20px; }
  .menu-sheet .menu-info { min-height: 36px; padding: 0 14px; font-size: 14px; }
  .menu-sheet .menu-sep { margin: 6px 0; }
  .menu-sheet .menu-cancel { display: flex; justify-content: center; margin-top: 6px; background: var(--surface-2); font-weight: 600; }
}
@keyframes sheet-in { from { transform: translateY(100%); } to { transform: none; } }
@keyframes sheet-out { from { transform: none; } to { transform: translateY(100%); } }

/* ---------- touch: comfortable targets ---------- */
@media (pointer: coarse) {
  .btn { height: 36px; }
  .btn-sm { height: 32px; }
  .btn-icon { width: 36px; }
  .btn-sm.btn-icon { width: 32px; }
  .copy-btn { height: 28px; padding: 0 10px; }
  .host-cell .copy-btn, .tunnel-status .copy-btn { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .live-dot.up::after { display: none; }
}
`;
