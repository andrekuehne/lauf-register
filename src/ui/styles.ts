// One small stylesheet, inlined into every page (no extra request on slow networks).
// Targets ~iOS 12 / Android 8 browsers: no flexbox `gap`, `-webkit-sticky` alongside `sticky`.

export const styles = `
:root{color-scheme:light;--fg:#111827;--muted:#4b5563;--bg:#f3f4f6;--card:#fff;--line:#9ca3af;
--accent:#0b5cad;--ok:#15803d;--danger:#b91c1c;--warn-bg:#fff7ed;--warn-line:#c2410c;--warn-fg:#7c2d12;--c:#374151}
.div-women{--c:#be185d}.div-men{--c:#1d4ed8}.div-womens_pair{--c:#7e22ce}.div-mens_pair{--c:#0f766e}.div-mixed_pair{--c:#c2410c}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);
font:18px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
[hidden]{display:none!important}
.top{display:flex;align-items:flex-start;justify-content:space-between;max-width:34rem;margin:0 auto;padding:12px 16px 4px}
.top-title{margin:0;font-size:1.05rem;font-weight:700;line-height:1.3}
.top-sub{display:block;font-size:.85rem;font-weight:400;color:var(--muted)}
.lang{flex-shrink:0;margin-left:12px;font-size:.9rem;line-height:1.3;padding-top:2px}
.lang a,.lang span{display:inline-block;padding:6px 4px}
.lang a{color:var(--accent)}
.lang span{font-weight:700}
main{max-width:34rem;margin:0 auto;padding:0 16px 40px}
h1,h2{font-size:1.6rem;line-height:1.2;margin:16px 0 14px}
h2:focus{outline:none}
p{margin:0 0 12px}
.muted{color:var(--muted)}
.bar{position:-webkit-sticky;position:sticky;top:0;z-index:2;margin:0 -16px 4px;background:var(--card);
box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:.95rem;line-height:1.3}
.bar-row{display:flex;align-items:center;min-height:48px;padding:2px 12px}
.bar-sel{flex:1;min-width:0;white-space:nowrap;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.bar-sel::-webkit-scrollbar{display:none}
.bar-sel button:disabled{text-decoration:none;cursor:default}
.bar-sel button{min-height:44px;font:inherit;font-weight:600;color:var(--fg);background:none;border:0;padding:6px 2px;text-decoration:underline;text-decoration-color:var(--line);cursor:pointer}
.bar-sel .sep{color:var(--muted);padding:0 3px}
.stepno{flex-shrink:0;margin-left:8px;font-size:.85rem;color:var(--muted);white-space:nowrap}
.progress{height:4px;background:#e5e7eb;overflow:hidden}
.progress i{display:block;height:100%;background:var(--accent);transition:width .2s}
.row{display:flex}
.row .field{flex:1;min-width:0}
.row .field+.field{margin-left:10px}
.choice{display:flex;align-items:center;width:100%;min-height:76px;margin:0 0 12px;padding:12px 16px;
font:inherit;text-align:left;color:var(--fg);background:var(--card);border:2px solid var(--c);border-radius:14px;cursor:pointer}
.choice b{display:block;font-size:1.15rem}
.choice small{display:block;font-size:.9rem;color:var(--muted)}
.choice[aria-pressed=true]{background:var(--c);color:#fff}
.choice[aria-pressed=true] small{color:#fff}
.ico{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:48px;height:48px;margin-right:14px;border-radius:50%;background:var(--c);color:#fff}
.ico svg{width:30px;height:30px;fill:currentColor}
.choice[aria-pressed=true] .ico{background:#fff;color:var(--c)}
.btn{display:block;width:100%;min-height:56px;margin:20px 0 0;padding:12px 16px;font:inherit;font-weight:700;font-size:1.1rem;
color:#fff;background:var(--accent);border:0;border-radius:12px;cursor:pointer}
.btn:disabled{opacity:.6}
a.btn{text-align:center;text-decoration:none}
.btn-secondary{color:var(--accent);background:var(--card);border:2px solid var(--accent)}
.back{display:block;margin:14px auto 0;padding:12px 16px;font:inherit;color:var(--accent);background:none;border:0;text-decoration:underline;cursor:pointer}
.person{margin:0 0 16px;padding:12px 16px 16px;background:var(--card);border-radius:14px;border-left:6px solid var(--c)}
.field{margin-top:14px}
.label,label.label{display:block;font-weight:600;margin-bottom:6px}
.label small{font-weight:400;color:var(--muted)}
input[type=text],input[type=date]{display:block;width:100%;min-height:52px;padding:10px 12px;font:inherit;color:var(--fg);background:#fff;
border:2px solid var(--line);border-radius:10px;-webkit-appearance:none;appearance:none}
input[type=text]:focus,input[type=date]:focus{outline:3px solid #93c5fd;border-color:var(--accent)}
input[aria-invalid=true]{border-color:var(--danger)}
.year{max-width:6.5rem}
.with-side{display:flex;align-items:center;min-height:52px}
.with-side .side{flex:1;min-width:0;margin-left:12px}
.with-side .side .error,.with-side .side .hint,.side-note{margin:0;font-size:.85rem;line-height:1.25}
.with-side .side .hint{padding:6px 8px}
.side-note{color:var(--muted)}
.with-side .pills{flex-shrink:0;margin-bottom:-8px}
.pill input:disabled+span{color:var(--muted);background:#e5e7eb;border-style:dashed;cursor:not-allowed}
.pills{display:flex;flex-wrap:wrap;margin:0 -8px -8px 0}
.pill{position:relative;margin:0 8px 8px 0}
.pill input{position:absolute;opacity:0;width:1px;height:1px}
.pill span{display:flex;align-items:center;justify-content:center;min-width:58px;min-height:48px;padding:6px 14px;
border:2px solid var(--line);border-radius:24px;background:#fff;font-weight:600;cursor:pointer}
.pill input:checked+span{background:var(--fg);border-color:var(--fg);color:#fff}
.pill input:focus+span{outline:3px solid #93c5fd}
.error{margin:6px 0 0;color:var(--danger);font-weight:600;font-size:.95rem}
.hint,.alert{margin:8px 0 0;padding:8px 12px;background:var(--warn-bg);border-left:4px solid var(--warn-line);color:var(--warn-fg);font-size:.95rem;border-radius:6px}
.alert{margin:16px 0 0;font-weight:600}
.summary{background:var(--card);border-radius:14px;padding:4px 16px 8px;margin-bottom:16px}
.cat{display:inline-block;margin:12px 0 4px;padding:6px 12px;border-radius:8px;background:var(--c);color:#fff;font-weight:700}
.sum-person{padding:10px 0;border-top:1px solid #e5e7eb}
.sum-person:first-of-type{border-top:0}
.sum-person b{display:block;font-size:1.1rem}
.sum-person span{display:block;color:var(--muted)}
.consent{display:flex;align-items:flex-start;padding:12px;background:var(--card);border-radius:12px;cursor:pointer}
.consent input{flex-shrink:0;width:28px;height:28px;margin:2px 12px 0 0}
.done{margin-top:20px;padding:24px 16px;text-align:center;color:#fff;background:var(--c);border-radius:16px}
.done .ico{margin:0 auto 8px;width:64px;height:64px;background:#fff;color:var(--c)}
.done .ico svg{width:40px;height:40px}
.done h2{margin:0 0 6px;font-size:1.3rem}
.done-cat{font-size:1.6rem;font-weight:800;line-height:1.2}
.done-names{margin:8px 0 0}
.done-label{margin:18px 0 0;font-size:.95rem}
.done-number{font-size:3.6rem;font-weight:800;line-height:1.1;letter-spacing:.02em}
.card{display:block;margin:0 0 12px;padding:12px 16px 16px;background:var(--card);border-radius:14px}
.card h2{margin-top:4px}
.admin-who{font-size:.9rem;margin-top:4px}
.race-list{list-style:none;margin:0;padding:0}
.race-list li>*{display:block}
.race-name{font-size:1.15rem}
.race-link{margin:6px 0;color:var(--accent);word-break:break-all}
.race-list li>.reg-switch{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:4px 0 8px}
.reg-state{margin-right:12px}
.reg-open{color:var(--ok)}
.form-note{margin:10px 0 0;font-size:.9rem}
.reg-closed{color:var(--muted)}
.btn-small{min-height:44px;padding:8px 14px;font:inherit;font-size:.95rem;font-weight:700;color:var(--accent);background:var(--card);
border:2px solid var(--accent);border-radius:10px;cursor:pointer}
.race-regs{margin:2px 0 6px;color:var(--accent);font-weight:700}
.reg-list{list-style:none;margin:0;padding:0}
.reg-duration h2{margin:28px 0 4px;padding-bottom:4px;border-bottom:2px solid var(--line)}
.reg-group{margin:16px 0 8px;font-size:1.1rem;color:var(--c)}
.reg{border-left:6px solid var(--c)}
.reg-head{display:flex;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.reg-no{min-width:3.2rem;margin-right:10px;font-size:1.5rem;line-height:1.2}
.reg-cat{display:flex;align-items:center;flex:1;min-width:0;margin-right:10px;color:var(--c);font-weight:700}
.reg-cat .ico{width:30px;height:30px;margin-right:8px}
.reg-cat .ico svg{width:20px;height:20px}
.reg-time{font-size:.9rem}
.reg-person{margin:4px 0 0}
.dup{margin:4px 0 0;padding:4px 8px;background:var(--warn-bg);border-left:4px solid var(--warn-line);color:var(--warn-fg);font-size:.9rem;font-weight:600;border-radius:4px}
.reg-delete{display:inline-block;margin-top:8px;padding:6px 0;color:var(--danger);font-size:.95rem}
.btn-danger{background:var(--danger)}
.cancel{margin-top:14px;text-align:center}
.note{padding:12px;background:var(--warn-bg);border-radius:8px}
`;
