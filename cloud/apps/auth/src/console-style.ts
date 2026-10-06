// Tokens copied from src/renderer/src/assets/main.css (:root and .dark) so the console matches the app;
// the brand gradient stops are the ones in resources/logo-gradient.svg.
const TOKENS = `:root{color-scheme:light dark;--background:#fff;--foreground:#0b1220;--card:#fff;--muted:#f1f5f9;
--muted-foreground:#64748b;--primary:#2563eb;--primary-foreground:#f8fafc;--destructive:#e40014;--border:#e2e8f0;
--input:#e2e8f0;--ring:#60a5fa;--status-success:#15803d;--sidebar:#f8fafc;--accent:#eff6ff;--radius:.625rem;
--brand-1:#1d4ed8;--brand-2:#2563eb;--brand-3:#06b6d4;--shadow:0 1px 2px rgb(15 23 42/.06),0 8px 24px rgb(15 23 42/.06);
--sidebar-w:248px;--ease:cubic-bezier(.2,.8,.2,1)}
@media (prefers-color-scheme:dark){:root{--background:#0b1220;--foreground:#f8fafc;--card:#111a2e;--muted:#1a2438;
--muted-foreground:#94a3b8;--destructive:#ff6568;--border:rgb(255 255 255/.07);--input:rgb(255 255 255/.15);
--ring:#3b82f6;--status-success:#86efac;--sidebar:#0e1729;--accent:rgb(37 99 235/.16);
--shadow:0 1px 2px rgb(0 0 0/.3),0 8px 24px rgb(0 0 0/.25)}}`

const BASE = `*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--background);
color:var(--foreground);-webkit-font-smoothing:antialiased}
h1{font-size:22px;line-height:1.25;margin:0;letter-spacing:-.01em}h2{font-size:16px;margin:0}p{margin:0}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
.muted{color:var(--muted-foreground)}.error{color:var(--destructive)}.notice{color:var(--status-success)}
.alert{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:calc(var(--radius) - 2px);
border:1px solid currentColor;background:color-mix(in srgb,currentColor 8%,transparent);animation:rise .3s var(--ease)}
form{display:grid;gap:14px}label{display:grid;gap:6px;font-weight:500}
input{font:inherit;padding:9px 12px;border-radius:calc(var(--radius) - 2px);border:1px solid var(--input);
background:var(--background);color:inherit;width:100%;transition:border-color .15s,box-shadow .15s}
input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 35%,transparent)}
button,.button{font:inherit;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;
padding:8px 14px;border-radius:calc(var(--radius) - 2px);border:1px solid var(--border);background:var(--muted);
color:var(--foreground);cursor:pointer;justify-self:start;transition:background .15s,transform .15s,box-shadow .15s,opacity .15s}
button:hover,.button:hover{text-decoration:none;filter:brightness(.97)}button:active{transform:translateY(1px)}
button.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
button.primary:hover{box-shadow:0 6px 16px color-mix(in srgb,var(--primary) 30%,transparent);filter:none;transform:translateY(-1px)}
button.danger{background:var(--destructive);border-color:var(--destructive);color:#fff}
button.block{width:100%;justify-self:stretch;padding:10px 14px}
button.ghost,.button.ghost{background:transparent;border-color:transparent}button.ghost:hover,.button.ghost:hover{background:var(--muted)}
button[aria-busy=true]{opacity:.7;pointer-events:none}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
svg.icon{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.card{background:var(--card);border:1px solid var(--border);border-radius:calc(var(--radius) + 4px);padding:24px;
display:grid;grid-template-columns:minmax(0,1fr);gap:16px;min-width:0;box-shadow:var(--shadow);animation:rise .35s var(--ease) both}
.card-head{display:grid;gap:4px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:0}dt{color:var(--muted-foreground)}
dd{margin:0;overflow-wrap:anywhere}
.badge{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:500;
background:var(--muted);color:var(--muted-foreground)}
.badge.ok{background:color-mix(in srgb,var(--status-success) 14%,transparent);color:var(--status-success)}
.badge.brand{background:var(--accent);color:var(--primary)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,-18px) scale(1.08)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`

const AUTH = `.auth{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
.brand-panel{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;
padding:40px;color:#fff;background:linear-gradient(140deg,var(--brand-1),var(--brand-2) 52%,var(--brand-3))}
.brand-panel::before,.brand-panel::after{content:"";position:absolute;border-radius:50%;filter:blur(60px);opacity:.45;
animation:drift 14s ease-in-out infinite}
.brand-panel::before{width:380px;height:380px;background:#22d3ee;top:-80px;right:-60px}
.brand-panel::after{width:320px;height:320px;background:#1e3a8a;bottom:-90px;left:-40px;animation-delay:-7s}
.brand-panel>*{position:relative;z-index:1}
.brand-mark{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:600}
.brand-mark .logo{width:36px;height:36px;padding:6px;border-radius:10px;background:rgb(255 255 255/.95)}
.brand-copy{display:grid;gap:14px;max-width:420px;animation:rise .5s var(--ease) both}
.brand-copy h2{font-size:30px;line-height:1.15;letter-spacing:-.02em}
.brand-copy p{opacity:.88;font-size:15px}.brand-foot{opacity:.7}
.brand-points{display:grid;gap:10px;margin:8px 0 0;padding:0;list-style:none}
.brand-points li{display:flex;gap:10px;align-items:center;opacity:.92}
.brand-points svg{width:18px;height:18px;padding:3px;border-radius:50%;background:rgb(255 255 255/.18)}
.auth-main{display:grid;place-items:center;padding:32px 16px}
.auth-card{width:100%;max-width:400px;display:grid;gap:22px;animation:rise .45s var(--ease) .05s both}
.auth-card .mobile-logo{display:none}.auth-card .logo{width:44px;height:44px}
.auth-foot{text-align:center}
.password{position:relative}.password input{padding-right:76px}
.password button{position:absolute;right:4px;top:50%;transform:translateY(-50%);padding:4px 10px;font-size:12px}
@media (max-width:900px){.auth{grid-template-columns:1fr}.brand-panel{display:none}
.auth-card .mobile-logo{display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px}
.auth-main{background:radial-gradient(1200px 400px at 50% -10%,var(--accent),transparent)}}`

const SHELL = `.shell{min-height:100vh;display:grid;grid-template-columns:var(--sidebar-w) minmax(0,1fr);transition:grid-template-columns .25s var(--ease)}
[data-sidebar=collapsed] .shell{grid-template-columns:68px minmax(0,1fr)}
.sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:8px;padding:14px 12px;
background:var(--sidebar);border-right:1px solid var(--border);overflow:hidden}
.side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px}
.side-brand{display:flex;align-items:center;gap:10px;font-weight:600;white-space:nowrap;color:inherit}
.side-brand:hover{text-decoration:none}.side-brand .logo{width:30px;height:30px;flex:none}
.side-label{transition:opacity .2s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
nav{display:grid;gap:2px;margin-top:8px}
.nav-section{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-foreground);
padding:8px 10px 4px}
.nav-item{display:flex;align-items:center;gap:12px;padding:9px 11px;border-radius:calc(var(--radius) - 2px);
color:var(--muted-foreground);font-weight:500;transition:background .15s,color .15s}
.nav-item:hover{background:var(--muted);color:var(--foreground);text-decoration:none}
.nav-item[aria-current=page]{background:var(--accent);color:var(--primary)}
.nav-item .count{margin-left:auto;font-size:12px}
.side-foot{margin-top:auto;display:grid;gap:8px;border-top:1px solid var(--border);padding-top:12px}
.account{display:flex;align-items:center;gap:10px;min-width:0}
.avatar{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;
color:#fff;background:linear-gradient(140deg,var(--brand-2),var(--brand-3))}
.side-foot form{display:block}.side-foot button{width:100%;justify-content:flex-start;gap:12px;padding:9px 11px}
[data-sidebar=collapsed] .side-label,[data-sidebar=collapsed] .nav-section,[data-sidebar=collapsed] .count{opacity:0;width:0;padding:0}
[data-sidebar=collapsed] .side-head{flex-direction:column}
.content{min-width:0;display:flex;flex-direction:column}
.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:12px 24px;
background:color-mix(in srgb,var(--background) 85%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.topbar .menu{display:none}
.page{width:100%;max-width:960px;margin:0 auto;padding:28px 24px 48px;display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.page-head{display:grid;gap:4px;animation:rise .3s var(--ease) both}
.backdrop{display:none}
@media (max-width:768px){.shell,[data-sidebar=collapsed] .shell{grid-template-columns:minmax(0,1fr)}
.sidebar{position:fixed;inset:0 auto 0 0;z-index:20;width:min(280px,85vw);transform:translateX(-100%);
transition:transform .25s var(--ease);box-shadow:var(--shadow)}
[data-drawer=open] .sidebar{transform:none}
[data-sidebar=collapsed] .side-label,[data-sidebar=collapsed] .nav-section,[data-sidebar=collapsed] .count{opacity:1;width:auto}
[data-sidebar=collapsed] .side-head{flex-direction:row}
.sidebar .collapse{display:none}.topbar .menu{display:inline-flex}
[data-drawer=open] .backdrop{display:block;position:fixed;inset:0;z-index:15;background:rgb(2 6 23/.45);animation:rise .2s}
.topbar,.page{padding-left:16px;padding-right:16px}}`

const MEMBERS = `.filters{display:grid;grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,1fr)) auto;gap:12px;align-items:end}
.filters .actions{display:flex;gap:8px}
.table{margin:0 -24px}table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:12px 24px;border-bottom:1px solid var(--border);vertical-align:middle}
th{font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-foreground)}
tbody tr{transition:background .15s}tbody tr:hover{background:color-mix(in srgb,var(--muted) 60%,transparent)}
tbody tr:last-child td{border-bottom:none}
.person{display:flex;align-items:center;gap:12px;min-width:0}.person>div{min-width:0}
.person strong{display:block;font-weight:500;overflow-wrap:anywhere}.person .muted{font-size:13px;overflow-wrap:anywhere}
.row-actions{display:flex;gap:4px;justify-content:flex-end;position:relative}
details.pop{position:relative}details.pop>summary{list-style:none;cursor:pointer}
details.pop>summary::-webkit-details-marker{display:none}
.pop-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:10;width:280px;padding:16px;display:grid;gap:12px;
background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);animation:rise .18s var(--ease)}
.pop-panel .buttons{display:flex;gap:8px;justify-content:flex-end}
.empty{text-align:center;padding:36px 16px;display:grid;gap:6px;justify-items:center}
@media (max-width:768px){.filters{grid-template-columns:1fr 1fr}.filters label:first-child,.filters .actions{grid-column:1/-1}.filters input{min-width:0}
.table{margin:0}thead{display:none}table,tbody,tr,td{display:block}
tr{border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;padding:8px 0}
td{border:none;padding:6px 14px;display:flex;justify-content:space-between;gap:12px}
td[data-label]::before{content:attr(data-label);color:var(--muted-foreground);font-size:13px}
td.person-cell::before{display:none}.row-actions{justify-content:flex-start}.pop-panel{left:0;right:auto}}`

// Work view: the canvas palette is the pixel-art scene's own, so only the frame uses console tokens.
const OFFICE = `.page.wide{max-width:none}
.office-stage{display:flex;flex-direction:column;height:calc(100vh - 190px);min-height:420px;overflow:hidden;
border:1px solid var(--border);border-radius:calc(var(--radius) + 4px);background:#e8d9bf;box-shadow:var(--shadow)}
.office-stage:fullscreen,.office-stage.tv{height:100vh;min-height:0;border:0;border-radius:0;box-shadow:none}
.office-bar,.office-legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:8px 12px;background:var(--card)}
.office-bar{border-bottom:1px solid var(--border)}
.office-legend{border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground);padding:6px 12px}
.office-stats{font-variant-numeric:tabular-nums;color:var(--muted-foreground)}.office-stats b{color:var(--foreground)}
.office-tools{display:flex;gap:4px;margin-left:auto}.office-tools button{padding:6px 10px}
.office-tools button[aria-pressed=true]{background:var(--accent);color:var(--primary)}
.office-conn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted-foreground)}
.office-conn::before{content:"";width:8px;height:8px;border-radius:50%;background:#9aa6b0}
.office-conn[data-conn=live]::before{background:#45d16b}.office-conn[data-conn=retrying]::before{background:#f2a93b}
.office-host{position:relative;flex:1;min-height:0}
.office-dot{display:inline-block;width:8px;height:8px;margin-right:6px;vertical-align:1px}
.office-links{display:grid;margin:0;padding:0;list-style:none}
.office-links li{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)}
.office-links li:first-child{border-top:0}.office-links form{display:block}
.office-new-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}
.office-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
@media (max-width:768px){.office-stage{height:70vh}.office-new-link{grid-template-columns:1fr}}`

export const CONSOLE_STYLE = [TOKENS, BASE, AUTH, SHELL, MEMBERS, OFFICE].join('\n')
