/**
 * dsh-sci-plot — 01-primitives
 *
 * Component-level stylesheet (rendered as a <style> element inside the panel so
 * unmounting removes it) plus the shared UI primitives. Only host theme tokens
 * are used for surfaces, borders and labels; fixed artwork colours are reserved
 * for the figure preview and quality badges.
 */

    const STYLES = `
      .scp-root {
        --scp-bg: var(--dsw-alias-bg-base, #fbfbfa);
        --scp-layer1: var(--dsw-alias-bg-layer-1, #ffffff);
        --scp-layer2: var(--dsw-alias-bg-layer-2, #f5f5f2);
        --scp-layer3: var(--dsw-alias-bg-layer-3, #ececea);
        --scp-border: var(--dsw-alias-border-l1, rgba(20, 20, 20, 0.10));
        --scp-border2: var(--dsw-alias-border-l2, rgba(20, 20, 20, 0.16));
        --scp-border3: var(--dsw-alias-border-l3, rgba(20, 20, 20, 0.24));
        --scp-ink: var(--dsw-alias-label-primary, #1a1a1a);
        --scp-ink2: var(--dsw-alias-label-secondary, #4b4b47);
        --scp-ink3: var(--dsw-alias-label-tertiary, #7d7d76);
        --scp-caption: var(--dsw-alias-label-caption, #8b8b84);
        --scp-brand: var(--dsw-alias-brand-primary, #2c5f8a);
        --scp-brand-ink: var(--dsw-alias-label-primary-inverted, #ffffff);
        --scp-hover: var(--dsw-alias-interactive-bg-hover, rgba(20, 20, 20, 0.05));
        --scp-ok: var(--dsw-alias-state-success-primary, #2f7d5b);
        --scp-warn: var(--dsw-alias-state-warn-primary, #9a6a15);
        --scp-danger: var(--dsw-alias-state-error-primary, #b03a2e);
        --scp-info: #2c5f8a;
        --scp-radius: var(--dsw-radius-md, 8px);
        --scp-radius-lg: var(--dsw-radius-lg, 12px);
        --scp-shadow: var(--dsw-shadow-lv1, 0 1px 2px rgba(0, 0, 0, 0.06));
        --scp-font: var(--dsw-alias-font-family-sans, "Segoe UI Variable Text", "Segoe UI", -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif);
        --scp-mono: var(--dsw-alias-font-family-mono, ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace);
        --scp-serif: var(--dsw-alias-font-family-serif, "Iowan Old Style", Georgia, "Songti SC", "Noto Serif SC", serif);
        --scp-inkblue: ${INK_BLUE};
        --scp-ochre: ${OCHRE};
        --scp-paper: ${CHART_PAPER};
        --scp-checker-a: #ffffff;
        --scp-checker-b: #ededeb;
        color-scheme: light;
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background: var(--scp-bg);
        color: var(--scp-ink);
        font-family: var(--scp-font);
        font-size: 13px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      .scp-root[data-scp-theme="dark"] {
        color-scheme: dark;
        --scp-inkblue: #7fa9c9;
        --scp-ochre: #d08a68;
        --scp-checker-a: #f7f7f5;
        --scp-checker-b: #e4e4e1;
      }
      .scp-root *, .scp-root *::before, .scp-root *::after { box-sizing: border-box; }
      .scp-root button, .scp-root input, .scp-root select, .scp-root textarea { font: inherit; color: inherit; }
      .scp-root ::selection { background: color-mix(in srgb, var(--scp-brand) 24%, transparent); }
      .scp-root ::-webkit-scrollbar { width: 10px; height: 10px; }
      .scp-root ::-webkit-scrollbar-thumb { background: var(--scp-border2); border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }
      .scp-root ::-webkit-scrollbar-track { background: transparent; }

      .scp-shell { display: flex; flex-direction: column; flex: 1; min-height: 0; }

      /* topbar ---------------------------------------------------------- */
      .scp-topbar {
        display: flex; align-items: center; gap: 10px;
        height: 48px; flex: none; padding: 0 14px;
        background: var(--scp-layer1);
        border-bottom: 1px solid var(--scp-border);
        min-width: 0;
      }
      .scp-brand { display: flex; align-items: center; gap: 9px; min-width: 0; flex: none; }
      .scp-brand-mark {
        width: 26px; height: 26px; flex: none;
        display: grid; place-items: center;
        border: 1px solid var(--scp-border2);
        border-radius: var(--scp-radius);
        background: var(--scp-layer2);
        color: var(--scp-ink);
      }
      .scp-brand-text { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
      .scp-brand-title { font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em; line-height: 1.25; white-space: nowrap; }
      .scp-brand-sub { font-size: 10.5px; line-height: 1.3; color: var(--scp-ink3); white-space: nowrap; }
      .scp-topbar-mid { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .scp-topbar-sep { width: 1px; height: 18px; background: var(--scp-border); flex: none; }
      .scp-spacer { flex: 1; min-width: 8px; }
      .scp-topbar-actions { display: flex; align-items: center; gap: 6px; flex: none; }
      .scp-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--scp-ink3); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--scp-ink3); flex: none; }
      .scp-status[data-state="ok"] .scp-status-dot { background: var(--scp-ok); }
      .scp-status[data-state="down"] { color: var(--scp-danger); }
      .scp-status[data-state="down"] .scp-status-dot { background: var(--scp-danger); }

      /* body / rail ----------------------------------------------------- */
      .scp-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
      .scp-rail {
        width: 216px; flex: none;
        display: flex; flex-direction: column; gap: 12px;
        padding: 12px 10px;
        background: var(--scp-layer1);
        border-right: 1px solid var(--scp-border);
        overflow-y: auto;
      }
      .scp-nav { display: flex; flex-direction: column; gap: 2px; }
      .scp-nav-btn {
        display: flex; align-items: center; gap: 9px;
        width: 100%; height: 34px; padding: 0 10px;
        border: 1px solid transparent; border-radius: var(--scp-radius);
        background: transparent; color: var(--scp-ink2);
        font-size: 12.5px; font-weight: 500; text-align: left; cursor: pointer;
        white-space: nowrap;
      }
      .scp-nav-btn:hover { background: var(--scp-hover); color: var(--scp-ink); }
      .scp-nav-btn[aria-current="page"] {
        background: var(--scp-layer2);
        border-color: var(--scp-border2);
        color: var(--scp-ink);
        font-weight: 600;
      }
      .scp-nav-btn[aria-current="page"] .scp-nav-icon { color: var(--scp-inkblue); }
      .scp-nav-icon { display: inline-flex; color: var(--scp-ink3); flex: none; }
      .scp-nav-label { overflow: hidden; text-overflow: ellipsis; }
      .scp-rail-sep { height: 1px; background: var(--scp-border); margin: 2px 0; }
      .scp-rail-group-title {
        font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--scp-caption); padding: 0 10px;
      }
      .scp-rail-foot {
        margin-top: auto; padding: 10px 10px 2px;
        border-top: 1px solid var(--scp-border);
        font-size: 10.5px; color: var(--scp-caption); line-height: 1.6;
      }
      .scp-rail-foot strong { color: var(--scp-ink3); font-weight: 600; }
      .scp-rail-figure-count { font-variant-numeric: tabular-nums; }

      /* main ------------------------------------------------------------ */
      .scp-main { flex: 1; min-width: 0; min-height: 0; overflow: auto; background: var(--scp-bg); }
      .scp-view { padding: 20px 22px 56px; max-width: 1480px; margin: 0 auto; }
      .scp-view-head { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
      .scp-view-heading { min-width: 0; flex: 1 1 320px; }
      .scp-h1 { margin: 0; font-size: 19px; line-height: 1.25; font-weight: 600; letter-spacing: -0.01em; }
      .scp-sub { margin: 3px 0 0; font-size: 12px; line-height: 1.55; color: var(--scp-ink3); max-width: 720px; }
      .scp-kicker { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-caption); margin: 0 0 4px; }
      .scp-toolbar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: none; }
      .scp-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        height: 28px; padding: 0 10px;
        border: 1px solid var(--scp-border2); border-radius: var(--scp-radius);
        background: var(--scp-layer1); color: var(--scp-ink);
        font-size: 11.5px; font-weight: 500; white-space: nowrap; cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
      }
      .scp-btn:hover:not(:disabled) { background: var(--scp-layer2); border-color: var(--scp-border3); }
      .scp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .scp-btn[data-variant="primary"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); color: #ffffff; }
      .scp-btn[data-variant="primary"]:hover:not(:disabled) { background: #244f73; border-color: #244f73; }
      .scp-root[data-scp-theme="dark"] .scp-btn[data-variant="primary"] { background: #7fa9c9; border-color: #7fa9c9; color: #10161b; }
      .scp-btn[data-variant="ochre"] { background: var(--scp-ochre); border-color: var(--scp-ochre); color: #ffffff; }
      .scp-btn[data-variant="ghost"] { background: transparent; border-color: transparent; color: var(--scp-ink2); }
      .scp-btn[data-variant="ghost"]:hover:not(:disabled) { background: var(--scp-hover); color: var(--scp-ink); }
      .scp-btn[data-variant="danger"] { background: transparent; border-color: color-mix(in srgb, var(--scp-danger) 34%, transparent); color: var(--scp-danger); }
      .scp-btn[data-variant="danger"]:hover:not(:disabled) { background: color-mix(in srgb, var(--scp-danger) 8%, transparent); }
      .scp-btn[data-size="sm"] { height: 24px; padding: 0 8px; font-size: 11px; border-radius: calc(var(--scp-radius) - 1px); }
      .scp-btn[data-size="lg"] { height: 32px; padding: 0 14px; font-size: 12.5px; }
      .scp-btn[data-active="true"] { border-color: var(--scp-ink3); }
      .scp-icon-btn { width: 28px; padding: 0; }
      .scp-icon-btn[data-size="sm"] { width: 24px; }
      .scp-root button:focus-visible, .scp-root a:focus-visible, .scp-root input:focus-visible,
      .scp-root select:focus-visible, .scp-root textarea:focus-visible, .scp-root [role="button"]:focus-visible {
        outline: 2px solid var(--scp-brand); outline-offset: 2px;
      }

      /* filters --------------------------------------------------------- */
      .scp-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
      .scp-filter { display: inline-flex; align-items: center; gap: 6px; }
      .scp-filter-label { font-size: 11px; color: var(--scp-ink3); white-space: nowrap; }
      .scp-select, .scp-input, .scp-textarea {
        border: 1px solid var(--scp-border2); border-radius: calc(var(--scp-radius) - 1px);
        background: var(--scp-layer1); color: var(--scp-ink);
        font-size: 12px; height: 28px; padding: 0 8px; min-width: 0;
      }
      .scp-select { appearance: auto; cursor: pointer; }
      .scp-input:hover, .scp-select:hover, .scp-textarea:hover { border-color: var(--scp-border3); }
      .scp-textarea { height: auto; min-height: 76px; padding: 7px 9px; line-height: 1.5; resize: vertical; font-family: var(--scp-mono); font-size: 11.5px; }
      .scp-input[data-mono="true"] { font-family: var(--scp-mono); font-size: 11.5px; }
      .scp-count { font-size: 11px; color: var(--scp-caption); font-variant-numeric: tabular-nums; margin-left: auto; }
      .scp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .scp-span-2 { grid-column: 1 / -1; }
      .scp-field-label { font-size: 11px; font-weight: 600; color: var(--scp-ink2); letter-spacing: 0.01em; display: flex; align-items: center; gap: 6px; }
      .scp-field-label .scp-field-optional { font-weight: 400; color: var(--scp-caption); }
      .scp-hint { font-size: 10.5px; line-height: 1.5; color: var(--scp-caption); }
      .scp-row { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .scp-grow { flex: 1; min-width: 0; }
      .scp-muted { color: var(--scp-ink3); }
      .scp-dim { color: var(--scp-ink2); }
      .scp-mono { font-family: var(--scp-mono); font-size: 11px; font-variant-numeric: tabular-nums; }
      .scp-tnum { font-variant-numeric: tabular-nums; }
      .scp-sep { height: 1px; background: var(--scp-border); border: 0; margin: 12px 0; }
      .scp-link { color: var(--scp-inkblue); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--scp-inkblue) 35%, transparent); cursor: pointer; }
      .scp-link:hover { border-bottom-color: var(--scp-inkblue); }
      .scp-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
      .scp-scroll-x { overflow-x: auto; }

      /* chips / badges -------------------------------------------------- */
      .scp-chip {
        display: inline-flex; align-items: center; gap: 4px;
        border: 1px solid var(--scp-border2); border-radius: 999px;
        padding: 0 7px; height: 18px;
        font-size: 10.5px; line-height: 1; color: var(--scp-ink2);
        white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
      }
      .scp-chip[data-tone="ok"] { color: var(--scp-ok); border-color: color-mix(in srgb, var(--scp-ok) 32%, transparent); background: color-mix(in srgb, var(--scp-ok) 7%, transparent); }
      .scp-chip[data-tone="warn"] { color: var(--scp-warn); border-color: color-mix(in srgb, var(--scp-warn) 32%, transparent); background: color-mix(in srgb, var(--scp-warn) 7%, transparent); }
      .scp-chip[data-tone="danger"] { color: var(--scp-danger); border-color: color-mix(in srgb, var(--scp-danger) 32%, transparent); background: color-mix(in srgb, var(--scp-danger) 7%, transparent); }
      .scp-chip[data-tone="info"] { color: var(--scp-inkblue); border-color: color-mix(in srgb, var(--scp-inkblue) 32%, transparent); background: color-mix(in srgb, var(--scp-inkblue) 7%, transparent); }
      .scp-chip[data-tone="accent"] { color: var(--scp-ochre); border-color: color-mix(in srgb, var(--scp-ochre) 32%, transparent); background: color-mix(in srgb, var(--scp-ochre) 7%, transparent); }
      .scp-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
      .scp-qbadge {
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        min-width: 20px; height: 18px; padding: 0 5px;
        border-radius: 4px; border: 1px solid transparent;
        font-family: var(--scp-mono); font-size: 10.5px; font-weight: 600; line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .scp-qbadge[data-tone="ok"] { color: var(--scp-ok); background: color-mix(in srgb, var(--scp-ok) 10%, transparent); border-color: color-mix(in srgb, var(--scp-ok) 30%, transparent); }
      .scp-qbadge[data-tone="info"] { color: var(--scp-inkblue); background: color-mix(in srgb, var(--scp-inkblue) 9%, transparent); border-color: color-mix(in srgb, var(--scp-inkblue) 30%, transparent); }
      .scp-qbadge[data-tone="warn"] { color: var(--scp-warn); background: color-mix(in srgb, var(--scp-warn) 10%, transparent); border-color: color-mix(in srgb, var(--scp-warn) 30%, transparent); }
      .scp-qbadge[data-tone="danger"] { color: var(--scp-danger); background: color-mix(in srgb, var(--scp-danger) 10%, transparent); border-color: color-mix(in srgb, var(--scp-danger) 30%, transparent); }
      .scp-qscore { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink3); font-variant-numeric: tabular-nums; }
      .scp-cvd { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--scp-ink3); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-cvd-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--scp-warn); }
      .scp-cvd[data-safe="true"] .scp-cvd-dot { background: var(--scp-ok); }

      /* segmented control ---------------------------------------------- */
      .scp-seg {
        display: inline-flex; align-items: center; gap: 2px;
        padding: 2px; border: 1px solid var(--scp-border); border-radius: var(--scp-radius);
        background: var(--scp-layer2); flex: none;
      }
      .scp-seg-btn {
        height: 22px; padding: 0 8px; border: 0; border-radius: calc(var(--scp-radius) - 2px);
        background: transparent; color: var(--scp-ink3);
        font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
      }
      .scp-seg-btn:hover { color: var(--scp-ink2); }
      .scp-seg-btn[aria-pressed="true"] { background: var(--scp-layer1); color: var(--scp-ink); box-shadow: var(--scp-shadow); }

      /* gallery --------------------------------------------------------- */
      .scp-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(228px, 1fr)); gap: 12px; }
      .scp-card {
        display: flex; flex-direction: column; min-width: 0;
        border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg);
        background: var(--scp-layer1); overflow: hidden;
        cursor: pointer; text-align: left; padding: 0; color: inherit;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
      }
      .scp-card:hover { transform: translateY(-2px); box-shadow: var(--scp-shadow); border-color: var(--scp-border2); }
      .scp-card-thumb {
        position: relative; display: block; width: 100%;
        aspect-ratio: 5 / 4; overflow: hidden;
        border-bottom: 1px solid var(--scp-border);
        background: var(--scp-checker-a);
      }
      .scp-card-img { display: block; width: 100%; height: 100%; object-fit: contain; padding: 8px; }
      .scp-card-thumb-fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--scp-caption); background: var(--scp-layer2); }
      .scp-card-body { padding: 9px 11px 10px; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .scp-card-title { font-size: 12.5px; font-weight: 600; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-card-line { font-size: 11px; color: var(--scp-ink3); line-height: 1.4; display: flex; align-items: center; gap: 5px; min-width: 0; }
      .scp-card-line > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .scp-card-meta { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .scp-checker {
        background-color: var(--scp-checker-a);
        background-image: conic-gradient(var(--scp-checker-b) 25%, var(--scp-checker-a) 0 50%, var(--scp-checker-b) 0 75%, var(--scp-checker-a) 0);
        background-size: 12px 12px;
        background-position: 0 0;
      }
      .scp-ref-section { margin-top: 26px; }
      .scp-ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
      .scp-ref-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); overflow: hidden; background: var(--scp-layer1); display: flex; flex-direction: column; }
      .scp-ref-img { width: 100%; aspect-ratio: 4 / 3; object-fit: contain; padding: 6px; display: block; }
      .scp-ref-label { padding: 5px 8px 7px; font-size: 10.5px; color: var(--scp-ink3); border-top: 1px solid var(--scp-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* detail ---------------------------------------------------------- */
      .scp-backbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .scp-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 14px; align-items: start; }
      .scp-detail-main { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .scp-figure-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-figure-toolbar { display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-bottom: 1px solid var(--scp-border); flex-wrap: wrap; }
      .scp-figure-title { font-size: 12px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 160px; }
      .scp-figure-stage { padding: 14px; background: var(--scp-layer2); display: flex; justify-content: center; min-height: 280px; }
      .scp-figure-scroll { width: 100%; max-height: 62vh; overflow: auto; display: flex; justify-content: center; }
      .scp-figure-shell { background: var(--scp-paper); border: 1px solid var(--scp-border); box-shadow: var(--scp-shadow); display: flex; align-items: center; justify-content: center; flex: none; }
      .scp-figure-img { display: block; max-width: 100%; height: auto; background: var(--scp-paper); }
      .scp-figure-loading { display: flex; align-items: center; justify-content: center; min-height: 280px; color: var(--scp-ink3); }
      .scp-detail-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-panel-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--scp-border); }
      .scp-panel-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-panel-body { padding: 10px 12px 12px; }
      .scp-kv { display: grid; grid-template-columns: minmax(64px, auto) minmax(0, 1fr); gap: 4px 12px; margin: 0; }
      .scp-kv dt { font-size: 11px; color: var(--scp-ink3); line-height: 1.6; }
      .scp-kv dd { margin: 0; font-size: 11.5px; color: var(--scp-ink); line-height: 1.6; overflow-wrap: anywhere; text-align: right; font-variant-numeric: tabular-nums; }
      .scp-scoreline { display: flex; align-items: center; gap: 10px; }
      .scp-score-num { font-family: var(--scp-mono); font-size: 30px; font-weight: 600; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
      .scp-score-num[data-tone="ok"] { color: var(--scp-ok); }
      .scp-score-num[data-tone="info"] { color: var(--scp-inkblue); }
      .scp-score-num[data-tone="warn"] { color: var(--scp-warn); }
      .scp-score-num[data-tone="danger"] { color: var(--scp-danger); }
      .scp-score-summary { margin: 7px 0 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); }
      .scp-quality-counts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .scp-check-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; max-height: 300px; overflow: auto; }
      .scp-check-row { display: flex; align-items: flex-start; gap: 7px; padding: 5px 0; border-top: 1px solid var(--scp-border); }
      .scp-check-row:first-child { border-top: 0; }
      .scp-check-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; flex: none; background: var(--scp-caption); }
      .scp-check-row[data-status="pass"] .scp-check-dot { background: var(--scp-ok); }
      .scp-check-row[data-status="warn"] .scp-check-dot { background: var(--scp-warn); }
      .scp-check-row[data-status="fail"] .scp-check-dot { background: var(--scp-danger); }
      .scp-check-row[data-status="info"] .scp-check-dot { background: var(--scp-inkblue); }
      .scp-check-text { font-size: 11.5px; line-height: 1.5; color: var(--scp-ink2); min-width: 0; }
      .scp-export-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .scp-export-btn { justify-content: flex-start; }
      .scp-export-meta { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .scp-file-list { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
      .scp-file-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .scp-file-format { flex: none; width: 30px; font-family: var(--scp-mono); font-size: 10px; color: var(--scp-ink3); text-transform: uppercase; }
      .scp-file-path { flex: 1; min-width: 0; font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
      .scp-warning-list { margin: 0; padding: 0 0 0 14px; display: flex; flex-direction: column; gap: 4px; }
      .scp-warning-list li { font-size: 11.5px; line-height: 1.5; color: var(--scp-warn); }
      .scp-danger-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .scp-delete-hint { font-size: 11px; color: var(--scp-danger); line-height: 1.5; }

      /* studio ---------------------------------------------------------- */
      .scp-studio-grid { display: grid; grid-template-columns: 372px minmax(0, 1fr); gap: 16px; align-items: start; }
      .scp-form { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .scp-form-section { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-form-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--scp-border); background: color-mix(in srgb, var(--scp-layer2) 55%, transparent); }
      .scp-form-title { margin: 0; font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-form-body { padding: 11px 12px 13px; display: flex; flex-direction: column; gap: 10px; }
      .scp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-form-grid .scp-span-2 { grid-column: 1 / -1; }
      .scp-kind-search-wrap { position: relative; }
      .scp-kind-search-wrap .scp-input { width: 100%; padding-left: 28px; }
      .scp-kind-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--scp-caption); pointer-events: none; display: inline-flex; }
      .scp-kind-list { display: flex; flex-direction: column; gap: 2px; max-height: 232px; overflow: auto; border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-bg); padding: 3px; }
      .scp-kind-group { padding: 6px 7px 3px; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--scp-caption); }
      .scp-kind-btn {
        display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
        width: 100%; padding: 5px 7px; border: 1px solid transparent; border-radius: calc(var(--scp-radius) - 2px);
        background: transparent; cursor: pointer; text-align: left;
      }
      .scp-kind-btn:hover { background: var(--scp-hover); }
      .scp-kind-btn[aria-pressed="true"] { background: var(--scp-layer1); border-color: var(--scp-border2); }
      .scp-kind-name { font-size: 12px; font-weight: 600; color: var(--scp-ink); }
      .scp-kind-btn[aria-pressed="true"] .scp-kind-name { color: var(--scp-inkblue); }
      .scp-kind-summary { font-size: 10.5px; line-height: 1.4; color: var(--scp-ink3); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
      .scp-kind-empty { padding: 10px 8px; font-size: 11px; color: var(--scp-caption); }
      .scp-kind-detail { display: flex; flex-direction: column; gap: 6px; padding: 8px 9px; border: 1px dashed var(--scp-border2); border-radius: var(--scp-radius); background: var(--scp-bg); }
      .scp-kind-detail-text { font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); }
      .scp-tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
      .scp-option-list { display: flex; flex-direction: column; gap: 8px; }
      .scp-option-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 26px; }
      .scp-option-label { font-size: 11.5px; color: var(--scp-ink2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-option-control { flex: none; display: flex; align-items: center; gap: 6px; }
      .scp-option-control .scp-input, .scp-option-control .scp-select { height: 26px; }
      .scp-number { width: 64px; text-align: right; font-family: var(--scp-mono); font-size: 11px; height: 24px; padding: 0 6px; font-variant-numeric: tabular-nums; }
      .scp-range-wrap { display: flex; align-items: center; gap: 7px; }
      .scp-range { width: 104px; accent-color: var(--scp-inkblue); height: 16px; }
      .scp-switch {
        position: relative; width: 30px; height: 17px; flex: none;
        border: 1px solid var(--scp-border3); border-radius: 999px;
        background: var(--scp-layer2); cursor: pointer; padding: 0; transition: background 0.12s ease, border-color 0.12s ease;
      }
      .scp-switch[aria-checked="true"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); }
      .scp-switch-thumb {
        position: absolute; top: 1px; left: 1px; width: 13px; height: 13px;
        border-radius: 50%; background: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.12s ease;
      }
      .scp-switch[aria-checked="true"] .scp-switch-thumb { transform: translateX(13px); }
      .scp-checkline { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--scp-ink2); cursor: pointer; }
      .scp-checkline input { accent-color: var(--scp-inkblue); }
      .scp-color-wrap { display: flex; align-items: center; gap: 5px; }
      .scp-color-input { width: 26px; height: 24px; padding: 1px; border: 1px solid var(--scp-border2); border-radius: 5px; background: var(--scp-layer1); cursor: pointer; }
      .scp-color-text { width: 74px; font-family: var(--scp-mono); font-size: 10.5px; height: 24px; }
      .scp-style-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-labels-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 10px; }
      .scp-format-row { display: flex; flex-wrap: wrap; gap: 5px; }
      .scp-format-pill {
        height: 25px; padding: 0 10px;
        border: 1px solid var(--scp-border2); border-radius: 999px;
        background: transparent; color: var(--scp-ink2);
        font-family: var(--scp-mono); font-size: 10.5px; font-weight: 600; cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      .scp-format-pill:hover { background: var(--scp-hover); }
      .scp-format-pill[aria-pressed="true"] { background: var(--scp-inkblue); border-color: var(--scp-inkblue); color: #ffffff; }
      .scp-form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-render-btn { flex: 1; min-width: 120px; }
      .scp-mapping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
      .scp-mapping-grid .scp-span-2 { grid-column: 1 / -1; }
      .scp-paste-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-paste-status { font-size: 10.5px; line-height: 1.5; }
      .scp-paste-status[data-ok="true"] { color: var(--scp-ok); }
      .scp-paste-status[data-ok="false"] { color: var(--scp-danger); }
      .scp-validation { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); padding: 8px 10px; background: var(--scp-layer1); }
      .scp-validation-ok { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--scp-ok); }
      .scp-validation-issues { display: flex; flex-direction: column; gap: 4px; margin-top: 5px; }
      .scp-issue { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; line-height: 1.5; color: var(--scp-warn); }
      .scp-issue-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; margin-top: 6px; flex: none; }

      .scp-preview { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-preview-panel { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-preview-head { display: flex; align-items: center; gap: 8px; padding: 8px 11px; border-bottom: 1px solid var(--scp-border); flex-wrap: wrap; }
      .scp-preview-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-ink3); }
      .scp-preview-body { padding: 14px; background: var(--scp-layer2); min-height: 320px; display: flex; flex-direction: column; justify-content: center; }
      .scp-preview-stage { display: flex; justify-content: center; align-items: center; width: 100%; }
      .scp-preview-shell { background: var(--scp-paper); border: 1px solid var(--scp-border); box-shadow: var(--scp-shadow); max-width: 100%; display: flex; align-items: center; justify-content: center; }
      .scp-preview-img { display: block; max-width: 100%; max-height: 62vh; height: auto; background: var(--scp-paper); }
      .scp-preview-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 30px 16px; color: var(--scp-ink3); }
      .scp-preview-empty-title { font-size: 13px; font-weight: 600; color: var(--scp-ink2); margin: 0; }
      .scp-preview-empty-body { font-size: 11.5px; line-height: 1.55; margin: 0; max-width: 360px; }
      .scp-preview-quality { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 9px 11px; border-top: 1px solid var(--scp-border); background: var(--scp-layer1); }
      .scp-preview-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: auto; }
      .scp-preview-hint { font-size: 10.5px; line-height: 1.5; color: var(--scp-caption); margin: 0; }
      .scp-rendering { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; color: var(--scp-ink3); font-size: 12px; }

      /* library --------------------------------------------------------- */
      .scp-lib-section { margin-top: 22px; }
      .scp-lib-section:first-of-type { margin-top: 4px; }
      .scp-section-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; }
      .scp-section-title h2 { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
      .scp-section-title .scp-section-note { font-size: 10.5px; color: var(--scp-caption); }
      .scp-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }
      .scp-domain-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); padding: 12px 13px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .scp-domain-head { display: flex; align-items: flex-start; gap: 8px; }
      .scp-domain-name { font-size: 13px; font-weight: 600; line-height: 1.35; margin: 0; }
      .scp-domain-desc { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink3); }
      .scp-swatch-strip { display: flex; height: 12px; border-radius: 3px; overflow: hidden; border: 1px solid var(--scp-border); }
      .scp-swatch { flex: 1; min-width: 0; }
      .scp-domain-meta { display: flex; flex-wrap: wrap; gap: 5px; }
      .scp-domain-foot { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 2px; flex-wrap: wrap; }
      .scp-table-wrap { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); overflow: hidden; background: var(--scp-layer1); }
      .scp-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .scp-table th { text-align: left; font-weight: 600; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--scp-caption); background: var(--scp-layer2); padding: 7px 10px; border-bottom: 1px solid var(--scp-border); white-space: nowrap; }
      .scp-table td { padding: 7px 10px; border-bottom: 1px solid var(--scp-border); vertical-align: top; line-height: 1.5; }
      .scp-table tr:last-child td { border-bottom: 0; }
      .scp-table tbody tr:hover td { background: color-mix(in srgb, var(--scp-hover) 60%, transparent); }
      .scp-table .scp-num { font-family: var(--scp-mono); font-size: 10.5px; font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--scp-ink2); }
      .scp-palette-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .scp-palette-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); padding: 10px 12px 11px; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
      .scp-palette-head { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
      .scp-palette-name { font-size: 12.5px; font-weight: 600; margin: 0; }
      .scp-palette-source { font-size: 10px; color: var(--scp-caption); font-family: var(--scp-mono); }
      .scp-palette-swatches { display: flex; gap: 3px; flex-wrap: wrap; }
      .scp-palette-swatch { width: 22px; height: 22px; border-radius: 3px; border: 1px solid color-mix(in srgb, var(--scp-ink) 12%, transparent); }
      .scp-cmap-list { display: flex; flex-direction: column; gap: 6px; }
      .scp-cmap-row { display: flex; flex-direction: column; gap: 3px; padding: 6px 2px 8px; border-bottom: 1px solid var(--scp-border); }
      .scp-cmap-row:last-child { border-bottom: 0; }
      .scp-cmap-head { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
      .scp-cmap-name { font-size: 11.5px; font-weight: 600; }
      .scp-cmap-kind { font-size: 10px; color: var(--scp-caption); }
      .scp-cmap-bar { height: 14px; border-radius: 3px; border: 1px solid var(--scp-border); }
      .scp-size-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
      .scp-size-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-layer1); padding: 9px 11px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .scp-size-name { font-size: 12px; font-weight: 600; display: flex; align-items: baseline; gap: 6px; }
      .scp-size-mm { font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; }
      .scp-size-track { height: 6px; border-radius: 2px; background: var(--scp-layer2); border: 1px solid var(--scp-border); overflow: hidden; }
      .scp-size-fill { height: 100%; background: var(--scp-inkblue); opacity: 0.85; }
      .scp-size-note { font-size: 10.5px; line-height: 1.45; color: var(--scp-ink3); margin: 0; }

      /* data ------------------------------------------------------------ */
      .scp-data-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .scp-data-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .scp-data-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); overflow: hidden; }
      .scp-data-head { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; }
      .scp-data-title { margin: 0; font-size: 12.5px; font-weight: 600; line-height: 1.4; word-break: break-word; }
      .scp-data-meta { margin: 2px 0 0; font-size: 10.5px; color: var(--scp-caption); font-variant-numeric: tabular-nums; }
      .scp-data-body { padding: 0 12px 11px; display: flex; flex-direction: column; gap: 8px; }
      .scp-data-cols { display: flex; flex-wrap: wrap; gap: 4px; }
      .scp-col-chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--scp-border); border-radius: 4px; padding: 1px 5px; font-family: var(--scp-mono); font-size: 10px; color: var(--scp-ink2); background: var(--scp-bg); }
      .scp-col-kind { color: var(--scp-caption); font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
      .scp-data-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .scp-preview-wrap { border-top: 1px solid var(--scp-border); background: var(--scp-bg); padding: 8px 10px 10px; }
      .scp-preview-table { width: 100%; border-collapse: collapse; font-family: var(--scp-mono); font-size: 10px; }
      .scp-preview-table th { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--scp-border2); color: var(--scp-ink3); font-weight: 600; white-space: nowrap; }
      .scp-preview-table td { padding: 2px 6px; border-bottom: 1px solid var(--scp-border); color: var(--scp-ink2); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .scp-preview-table tr:last-child td { border-bottom: 0; }
      .scp-preview-note { margin: 6px 0 0; font-size: 10.5px; color: var(--scp-caption); line-height: 1.5; }

      /* settings -------------------------------------------------------- */
      .scp-settings-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
      .scp-settings-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .scp-engine-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .scp-engine-state { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
      .scp-engine-state .scp-status-dot { width: 7px; height: 7px; }
      .scp-engine-state[data-state="ok"] { color: var(--scp-ok); }
      .scp-engine-state[data-state="down"] { color: var(--scp-danger); }
      .scp-engine-state[data-state="unknown"] { color: var(--scp-ink3); }
      .scp-facts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 12px; margin-top: 9px; }
      .scp-fact { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .scp-fact-label { font-size: 10px; color: var(--scp-caption); text-transform: lowercase; font-family: var(--scp-mono); }
      .scp-fact-value { font-size: 11px; color: var(--scp-ink2); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
      .scp-font-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .scp-path-row { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-top: 1px solid var(--scp-border); min-width: 0; }
      .scp-path-row:first-child { border-top: 0; }
      .scp-path-label { flex: none; width: 84px; font-size: 10.5px; color: var(--scp-ink3); }
      .scp-path-value { flex: 1; min-width: 0; font-family: var(--scp-mono); font-size: 10.5px; color: var(--scp-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-pre { margin: 0; padding: 9px 10px; border: 1px solid var(--scp-border); border-radius: var(--scp-radius); background: var(--scp-bg); font-family: var(--scp-mono); font-size: 10.5px; line-height: 1.55; color: var(--scp-ink2); max-height: 260px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
      .scp-form-actions-end { display: flex; align-items: center; gap: 8px; margin-top: 2px; }

      /* empty / loading / error / notice -------------------------------- */
      .scp-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 20px; border: 1px dashed var(--scp-border2); border-radius: var(--scp-radius-lg); background: var(--scp-layer1); }
      .scp-empty-icon { color: var(--scp-ink3); margin-bottom: 10px; }
      .scp-empty-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--scp-ink); }
      .scp-empty-body { margin: 5px 0 0; max-width: 440px; font-size: 11.5px; line-height: 1.6; color: var(--scp-ink3); }
      .scp-empty-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: center; margin-top: 13px; }
      .scp-error { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--scp-danger) 30%, transparent); border-radius: var(--scp-radius-lg); background: color-mix(in srgb, var(--scp-danger) 5%, transparent); }
      .scp-error-title { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--scp-danger); }
      .scp-error-message { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--scp-ink2); overflow-wrap: anywhere; }
      .scp-loading { display: flex; align-items: center; gap: 8px; padding: 26px 6px; color: var(--scp-ink3); font-size: 12px; }
      .scp-spinner {
        width: 14px; height: 14px; flex: none; border-radius: 50%;
        border: 1.5px solid var(--scp-border2); border-top-color: var(--scp-inkblue);
        animation: scp-spin 0.7s linear infinite; display: inline-block;
      }
      .scp-spinner[data-size="sm"] { width: 11px; height: 11px; border-width: 1.2px; }
      @keyframes scp-spin { to { transform: rotate(360deg); } }
      .scp-skeleton { border-radius: 4px; background: linear-gradient(90deg, var(--scp-layer2), color-mix(in srgb, var(--scp-layer2) 55%, var(--scp-layer1)), var(--scp-layer2)); background-size: 200% 100%; animation: scp-shimmer 1.2s ease-in-out infinite; }
      @keyframes scp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      .scp-skeleton-card { border: 1px solid var(--scp-border); border-radius: var(--scp-radius-lg); overflow: hidden; background: var(--scp-layer1); }
      .scp-notice { display: flex; align-items: flex-start; gap: 7px; padding: 8px 10px; border: 1px solid var(--scp-border2); border-radius: var(--scp-radius); font-size: 11.5px; line-height: 1.5; background: var(--scp-layer1); color: var(--scp-ink2); }
      .scp-notice[data-tone="warn"] { border-color: color-mix(in srgb, var(--scp-warn) 30%, transparent); background: color-mix(in srgb, var(--scp-warn) 6%, transparent); color: var(--scp-warn); }
      .scp-notice[data-tone="err"] { border-color: color-mix(in srgb, var(--scp-danger) 30%, transparent); background: color-mix(in srgb, var(--scp-danger) 6%, transparent); color: var(--scp-danger); }
      .scp-notice[data-tone="ok"] { border-color: color-mix(in srgb, var(--scp-ok) 30%, transparent); background: color-mix(in srgb, var(--scp-ok) 6%, transparent); color: var(--scp-ok); }

      /* toast ----------------------------------------------------------- */
      .scp-toast {
        position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
        z-index: 60; display: flex; align-items: center; gap: 8px;
        max-width: min(560px, calc(100% - 32px));
        padding: 8px 12px; border-radius: var(--scp-radius);
        border: 1px solid var(--scp-border2);
        background: var(--dsw-alias-toast-bg, var(--scp-layer1));
        color: var(--dsw-alias-toast-label, var(--scp-ink));
        box-shadow: var(--dsw-shadow-lv2, 0 6px 24px rgba(0, 0, 0, 0.16));
        font-size: 12px; line-height: 1.45;
      }
      .scp-toast[data-tone="err"] { border-color: color-mix(in srgb, var(--scp-danger) 40%, transparent); color: var(--scp-danger); }
      .scp-toast[data-tone="ok"] .scp-toast-icon { color: var(--scp-ok); }
      .scp-toast-text { min-width: 0; overflow-wrap: anywhere; }
      .scp-toast-close { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0; display: inline-flex; opacity: 0.65; flex: none; }
      .scp-toast-close:hover { opacity: 1; }

      /* lightbox -------------------------------------------------------- */
      .scp-lightbox { position: fixed; inset: 0; z-index: 90; background: rgba(12, 12, 12, 0.9); display: flex; flex-direction: column; }
      .scp-lightbox-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; color: #f4f1ea; border-bottom: 1px solid rgba(255, 255, 255, 0.14); font-size: 12px; }
      .scp-lightbox-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .scp-lightbox-body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 16px; overflow: auto; }
      .scp-lightbox-img { max-width: 100%; max-height: 100%; object-fit: contain; background: #ffffff; }
      .scp-lightbox .scp-btn { color: #f4f1ea; border-color: rgba(255, 255, 255, 0.28); background: transparent; }
      .scp-lightbox .scp-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
      .scp-confirm-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

      /* stays a light artwork backdrop in both themes */
      .scp-checker.scp-checker {
        background-color: var(--scp-checker-a);
        background-image: conic-gradient(var(--scp-checker-b) 25%, var(--scp-checker-a) 0 50%, var(--scp-checker-b) 0 75%, var(--scp-checker-a) 0);
        background-size: 12px 12px;
        background-position: 0 0;
      }

      /* responsive ------------------------------------------------------ */
      @media (max-width: 1180px) {
        .scp-studio-grid { grid-template-columns: 330px minmax(0, 1fr); }
        .scp-detail-grid { grid-template-columns: minmax(0, 1fr) 320px; }
      }
      @media (max-width: 1024px) {
        .scp-detail-grid { grid-template-columns: 1fr; }
        .scp-detail-side { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: start; }
        .scp-palette-grid { grid-template-columns: 1fr; }
        .scp-settings-grid { grid-template-columns: 1fr; }
        .scp-data-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 900px) {
        .scp-body { flex-direction: column; }
        .scp-rail {
          width: auto; flex: none; flex-direction: row; align-items: center; gap: 6px;
          padding: 6px 10px; border-right: 0; border-bottom: 1px solid var(--scp-border);
          overflow-x: auto; overflow-y: hidden;
        }
        .scp-nav { flex-direction: row; gap: 2px; }
        .scp-nav-btn { width: auto; height: 30px; padding: 0 9px; flex: 0 0 auto; }
        .scp-rail-sep, .scp-rail-group-title, .scp-rail-foot { display: none; }
        .scp-studio-grid { grid-template-columns: 1fr; }
        .scp-preview-panel { position: static; }
        .scp-view { padding: 16px 16px 44px; }
        .scp-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); }
      }
      @media (max-width: 768px) {
        .scp-topbar { height: auto; min-height: 48px; padding: 7px 12px; flex-wrap: wrap; gap: 7px; }
        .scp-topbar-mid { display: none; }
        .scp-brand-sub { display: none; }
        .scp-view { padding: 14px 12px 40px; }
        .scp-view-head { gap: 10px; }
        .scp-view-heading { flex-basis: 100%; }
        .scp-h1 { font-size: 17px; }
        .scp-toolbar { width: 100%; }
        .scp-filters { width: 100%; }
        .scp-filter { flex: 1 1 132px; }
        .scp-filter .scp-select { flex: 1; width: 100%; }
        .scp-count { margin-left: 0; flex-basis: 100%; }
        .scp-form-grid, .scp-style-grid, .scp-labels-grid, .scp-mapping-grid { grid-template-columns: 1fr; }
        .scp-form-grid .scp-span-2, .scp-mapping-grid .scp-span-2 { grid-column: auto; }
        .scp-detail-side { grid-template-columns: 1fr; }
        .scp-figure-stage { padding: 8px; }
        .scp-preview-body { padding: 8px; min-height: 240px; }
        .scp-preview-img { max-height: 48vh; }
        .scp-export-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .scp-facts { grid-template-columns: 1fr; }
        .scp-toolbar .scp-btn { flex: 1 1 auto; }
        .scp-form-actions { display: grid; grid-template-columns: 1fr 1fr; }
        .scp-render-btn { grid-column: 1 / -1; }
        .scp-empty { padding: 32px 14px; }
        .scp-toast { bottom: 10px; }
      }
      @media (max-width: 480px) {
        .scp-gallery-grid { grid-template-columns: 1fr; }
        .scp-ref-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .scp-nav-btn { padding: 0 8px; }
        .scp-nav-label { font-size: 11.5px; }
        .scp-lib-grid { grid-template-columns: 1fr; }
        .scp-detail-side { display: flex; flex-direction: column; }
        .scp-figure-toolbar { gap: 4px; }
        .scp-card-thumb { aspect-ratio: 3 / 2; }
        .scp-settings-grid { gap: 10px; }
        .scp-export-btn { font-size: 11px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .scp-root *, .scp-root *::before, .scp-root *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
      }
    `

    /* ------------------------------------------------------------------ */
    /* Buttons and chips                                                  */
    /* ------------------------------------------------------------------ */

    function Button(props) {
      const p = props || {}
      const attributes = {
        type: p.type || "button",
        className: "scp-btn" + (p.iconOnly ? " scp-icon-btn" : "") + (p.className ? " " + p.className : ""),
        onClick: p.onClick,
        disabled: Boolean(p.disabled),
        title: p.title || undefined,
        "aria-label": p["aria-label"] || (p.iconOnly ? p.title || p.label : undefined) || undefined,
      }
      if (p.variant) attributes["data-variant"] = p.variant
      if (p.size) attributes["data-size"] = p.size
      if (p.active === true) attributes["data-active"] = "true"
      if (p.ariaPressed !== undefined) attributes["aria-pressed"] = p.ariaPressed ? "true" : "false"
      if (p.style) attributes.style = p.style
      const children = []
      if (p.glyph) children.push(h(Icon, { name: p.glyph, size: p.size === "sm" ? 12 : p.size === "lg" ? 15 : 13 }))
      if (!p.iconOnly && p.label !== undefined && p.label !== null) children.push(h("span", { key: "label" }, p.label))
      if (p.children) children.push.apply(children, Array.isArray(p.children) ? p.children : [p.children])
      return h("button", attributes, children)
    }

    function Chip(props) {
      const p = props || {}
      return h("span", { className: "scp-chip", "data-tone": p.tone || undefined, title: p.title || undefined }, p.dot ? h("span", { className: "scp-dot" }) : null, p.label)
    }

    function QualityBadge(props) {
      const p = props || {}
      const normalized = normalizeQuality(p.quality || { score: p.score, grade: p.grade })
      if (normalized.score === null && !normalized.grade) return null
      const grade = normalized.grade || qualityGrade(normalized.score)
      const tone = qualityTone(grade) || "info"
      const text = grade && normalized.score === null ? grade : normalized.score === null ? "—" : String(normalized.score) + (grade ? " " + grade : "")
      const titleKey = grade === "A" ? "qualityA" : grade === "B" ? "qualityB" : grade === "C" ? "qualityC" : grade === "D" ? "qualityD" : ""
      return h("span", {
        className: "scp-qbadge",
        "data-tone": tone,
        title: p.t && titleKey ? p.t(titleKey) : undefined,
      }, normalized.score !== null && grade ? h("span", null, normalized.score) : null, normalized.score !== null && grade ? h("span", { style: { opacity: 0.75, fontWeight: 500 } }, grade) : grade || "—")
    }

    function CvdBadge(props) {
      const p = props || {}
      const safe = p.safe === true
      const label = safe ? p.safeLabel : p.unsafeLabel
      const delta = toNumber(p.delta, null)
      return h(
        "span",
        { className: "scp-cvd", "data-safe": safe ? "true" : "false", title: p.title || label },
        h("span", { className: "scp-cvd-dot" }),
        h("span", null, label),
        delta !== null ? h("span", { style: { opacity: 0.7 } }, "ΔE " + fmtNum(delta, 0)) : null,
      )
    }

    function SectionTitle(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-section-title" },
        h("h2", null, p.title),
        p.note ? h("span", { className: "scp-section-note" }, p.note) : null,
        h("span", { className: "scp-grow" }),
        p.right || null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Form primitives                                                    */
    /* ------------------------------------------------------------------ */

    function Field(props) {
      const p = props || {}
      const label = p.label
      const labelNode = label
        ? h(
            "label",
            { className: "scp-field-label", htmlFor: p.htmlFor || p.id || undefined },
            h("span", null, label),
            p.optional ? h("span", { className: "scp-field-optional" }, "· " + (p.optionalLabel || "optional")) : null,
            p.right || null,
          )
        : null
      return h("div", { className: "scp-field" + (p.full ? " scp-span-2" : "") + (p.className ? " " + p.className : "") }, labelNode, p.children, p.hint ? h("span", { className: "scp-hint" }, p.hint) : null)
    }

    function Select(props) {
      const p = props || {}
      const options = safeArray(p.options)
      const attributes = {
        className: "scp-select" + (p.className ? " " + p.className : ""),
        value: p.value === undefined || p.value === null ? "" : String(p.value),
        onChange: (event) => {
          if (p.onChange) p.onChange(event.target.value)
        },
        disabled: Boolean(p.disabled),
        "aria-label": p["aria-label"] || p.title || undefined,
        title: p.title || undefined,
      }
      if (p.id) attributes.id = p.id
      if (p.style) attributes.style = p.style
      const children = p.children ? (Array.isArray(p.children) ? p.children : [p.children]) : options.map((option, index) => {
        const value = option && option.value !== undefined ? String(option.value) : ""
        return h("option", { key: option && option.value !== undefined ? value : "opt-" + index, value: value }, option && option.label !== undefined ? option.label : value)
      })
      return h("select", attributes, children)
    }

    function TextInput(props) {
      const p = props || {}
      const onChange = (event) => {
        if (p.onChange) p.onChange(event.target.value, event)
      }
      if (p.multiline === true) {
        return h("textarea", {
          id: p.id || undefined,
          className: "scp-textarea" + (p.className ? " " + p.className : ""),
          value: p.value === undefined || p.value === null ? "" : String(p.value),
          onChange: onChange,
          placeholder: p.placeholder || "",
          rows: p.rows || 5,
          disabled: Boolean(p.disabled),
          spellCheck: false,
          "aria-label": p["aria-label"] || p.title || undefined,
        })
      }
      return h("input", {
        id: p.id || undefined,
        type: p.type || "text",
        className: "scp-input" + (p.className ? " " + p.className : ""),
        value: p.value === undefined || p.value === null ? "" : String(p.value),
        onChange: onChange,
        placeholder: p.placeholder || "",
        disabled: Boolean(p.disabled),
        spellCheck: false,
        "data-mono": p.mono ? "true" : undefined,
        "aria-label": p["aria-label"] || p.title || undefined,
        style: p.style,
      })
    }

    function Switch(props) {
      const p = props || {}
      return h(
        "button",
        {
          type: "button",
          role: "switch",
          className: "scp-switch",
          "aria-checked": p.checked ? "true" : "false",
          "aria-label": p["aria-label"] || p.label || undefined,
          title: p.title || p.label || undefined,
          disabled: Boolean(p.disabled),
          onClick: () => {
            if (p.disabled) return
            if (p.onChange) p.onChange(!p.checked)
          },
        },
        h("span", { className: "scp-switch-thumb" }),
      )
    }

    function SliderControl(props) {
      const p = props || {}
      const step = toNumber(p.step, 1)
      const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3
      const min = toNumber(p.min, 0)
      const max = toNumber(p.max, 100)
      const value = clampNumber(p.value, min, max, min)
      const emit = (next) => {
        if (p.onChange) p.onChange(clampNumber(next, min, max, value))
      }
      return h(
        "span",
        { className: "scp-range-wrap" },
        h("input", {
          type: "range",
          className: "scp-range",
          min: min,
          max: max,
          step: step,
          value: value,
          onChange: (event) => emit(event.target.value),
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || undefined,
        }),
        h("input", {
          type: "number",
          className: "scp-input scp-number",
          min: min,
          max: max,
          step: step,
          value: fmtNumberInput(value, digits),
          onChange: (event) => {
            const raw = event.target.value
            if (raw === "") return
            const n = Number(raw)
            if (!Number.isFinite(n)) return
            emit(n)
          },
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || undefined,
        }),
      )
    }

    function fmtNumberInput(value, digits) {
      const n = toNumber(value, null)
      if (n === null) return ""
      if (digits <= 0) return String(Math.round(n))
      return String(Number(n.toFixed(digits)))
    }

    function ColorControl(props) {
      const p = props || {}
      const value = /^#[0-9a-f]{6}$/i.test(String(p.value || "")) ? String(p.value) : "#2c5f8a"
      return h(
        "span",
        { className: "scp-color-wrap" },
        h("input", {
          type: "color",
          className: "scp-color-input",
          value: value,
          onChange: (event) => p.onChange && p.onChange(event.target.value),
          disabled: Boolean(p.disabled),
          "aria-label": p["aria-label"] || p.label || "colour",
        }),
        h("input", {
          type: "text",
          className: "scp-input scp-color-text",
          value: p.value === undefined || p.value === null ? "" : String(p.value),
          onChange: (event) => p.onChange && p.onChange(event.target.value),
          disabled: Boolean(p.disabled),
          spellCheck: false,
          "aria-label": p["aria-label"] || p.label || "colour value",
        }),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Status primitives                                                  */
    /* ------------------------------------------------------------------ */

    function Spinner(props) {
      const p = props || {}
      return h("span", { className: "scp-spinner", "data-size": p.size || undefined, "aria-hidden": "true" })
    }

    function Loading(props) {
      const p = props || {}
      return h("div", { className: "scp-loading", role: "status" }, h(Spinner, null), h("span", null, p.label || "…"))
    }

    function Skeleton(props) {
      const p = props || {}
      return h("div", { className: "scp-skeleton", style: Object.assign({ height: p.height || 12, width: p.width || "100%" }, p.style || {}) })
    }

    function ErrorState(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-error", role: "alert" },
        h("p", { className: "scp-error-title" }, p.title || ""),
        p.message ? h("p", { className: "scp-error-message" }, p.message) : null,
        p.children || null,
        p.onRetry
          ? h("div", { style: { marginTop: 6 } }, h(Button, { size: "sm", glyph: "refresh", label: p.retryLabel || "Retry", onClick: p.onRetry }))
          : null,
      )
    }

    function EmptyState(props) {
      const p = props || {}
      return h(
        "div",
        { className: "scp-empty" },
        p.icon ? h("div", { className: "scp-empty-icon" }, h(Icon, { name: p.icon, size: 24 })) : null,
        h("p", { className: "scp-empty-title" }, p.title || ""),
        p.body ? h("p", { className: "scp-empty-body" }, p.body) : null,
        p.actions ? h("div", { className: "scp-empty-actions" }, p.actions) : null,
      )
    }

    function Notice(props) {
      const p = props || {}
      return h("div", { className: "scp-notice", "data-tone": p.tone || "info", role: p.tone === "err" ? "alert" : "status" }, p.children)
    }

    function Toast(props) {
      const p = props || {}
      const notice = p.notice
      if (!notice) return null
      const tone = notice.tone === "err" ? "err" : "ok"
      return h(
        "div",
        { className: "scp-toast", "data-tone": tone, role: "status", "aria-live": "polite" },
        h("span", { className: "scp-toast-icon", style: { display: "inline-flex" } }, h(Icon, { name: tone === "err" ? "warning" : "check", size: 13 })),
        h("span", { className: "scp-toast-text" }, notice.text),
        p.onClose
          ? h("button", { type: "button", className: "scp-toast-close", onClick: p.onClose, "aria-label": p.closeLabel || "close" }, h(Icon, { name: "x", size: 12 }))
          : null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Figure image + lightbox                                            */
    /* ------------------------------------------------------------------ */

    function FigureImage(props) {
      const p = props || {}
      const [failed, setFailed] = useState(false)
      const [attempt, setAttempt] = useState(0)
      useEffect(() => {
        setFailed(false)
      }, [p.src])
      if (!p.src) {
        return h("div", { className: "scp-card-thumb-fallback" }, h(Icon, { name: "image", size: 20 }))
      }
      if (failed) {
        const retryable = p.retryable !== false
        return h(
          "div",
          { className: "scp-card-thumb-fallback" },
          h(Icon, { name: "warning", size: 18 }),
          h("span", { style: { fontSize: 10.5, marginLeft: 6 } }, p.failedLabel || "image"),
          retryable
            ? h(
                "button",
                {
                  type: "button",
                  className: "scp-btn",
                  "data-size": "sm",
                  style: { marginLeft: 8 },
                  onClick: () => {
                    setFailed(false)
                    setAttempt((value) => value + 1)
                  },
                },
                p.retryLabel || "Retry",
              )
            : null,
        )
      }
      const src = attempt > 0 ? p.src + (p.src.indexOf("?") === -1 ? "?" : "&") + "retry=" + attempt : p.src
      return h("img", {
        className: p.className || "scp-card-img",
        src: src,
        alt: p.alt || "",
        loading: p.eager ? "eager" : "lazy",
        draggable: false,
        onError: () => setFailed(true),
        onClick: p.onClick,
        style: p.style,
      })
    }

    /** Div-based card that behaves like a button and stays keyboard reachable. */
    function clickableProps(onClick, ariaLabel) {
      return {
        role: "button",
        tabIndex: 0,
        "aria-label": ariaLabel || undefined,
        onClick: (event) => {
          if (onClick) onClick(event)
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
            event.preventDefault()
            if (onClick) onClick(event)
          }
        },
      }
    }

    function Lightbox(props) {
      const p = props || {}
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            if (p.onClose) p.onClose()
          }
        }
        window.addEventListener("keydown", onKey, true)
        return () => window.removeEventListener("keydown", onKey, true)
      }, [p.onClose])
      return h(
        "div",
        { className: "scp-lightbox", role: "dialog", "aria-modal": "true", "aria-label": p.title || "" },
        h(
          "div",
          { className: "scp-lightbox-bar" },
          h(Icon, { name: "image", size: 14 }),
          h("span", { className: "scp-lightbox-title" }, p.title || ""),
          p.href
            ? h(
                "a",
                { className: "scp-btn", "data-size": "sm", href: p.href, target: "_blank", rel: "noreferrer noopener", style: { textDecoration: "none", color: "#f4f1ea", borderColor: "rgba(255,255,255,.28)" } },
                h(Icon, { name: "external", size: 12 }),
                h("span", null, p.openLabel || "open"),
              )
            : null,
          h(Button, { size: "sm", iconOnly: true, glyph: "x", title: p.closeLabel || "close", onClick: p.onClose }),
        ),
        h("div", { className: "scp-lightbox-body", onMouseDown: (event) => { if (event.target === event.currentTarget && p.onClose) p.onClose() } }, h("img", { className: "scp-lightbox-img", src: p.src, alt: p.alt || p.title || "" })),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Small layout helpers                                               */
    /* ------------------------------------------------------------------ */

    function KV(props) {
      const p = props || {}
      const rows = safeArray(p.rows)
      return h(
        "dl",
        { className: "scp-kv" },
        rows.map((row, index) => [
          h("dt", { key: "k" + index }, row.label),
          h("dd", { key: "v" + index, className: row.mono ? "scp-mono" : undefined }, row.value === undefined || row.value === null || row.value === "" ? "—" : row.value),
        ]),
      )
    }

    function StatusLine(props) {
      const p = props || {}
      return h("span", { className: "scp-status", "data-state": p.state || "unknown" }, h("span", { className: "scp-status-dot" }), h("span", null, p.label))
    }
