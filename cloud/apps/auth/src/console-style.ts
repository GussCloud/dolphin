// Tokens copied from src/renderer/src/assets/main.css (:root and .dark) so the console matches the app;
// the brand gradient stops are the ones in resources/logo-gradient.svg.
const TOKENS = `:root{color-scheme:light dark;--background:#fff;--foreground:#0b1220;--card:#fff;--muted:#f1f5f9;
--muted-foreground:#64748b;--primary:#2563eb;--primary-foreground:#f8fafc;--destructive:#e40014;--border:#e2e8f0;
--input:#e2e8f0;--ring:#60a5fa;--status-success:#15803d;--sidebar:#f8fafc;--accent:#eff6ff;--radius:.625rem;
--brand-1:#1d4ed8;--brand-2:#2563eb;--brand-3:#06b6d4;--shadow:0 1px 2px rgb(15 23 42/.06),0 8px 24px rgb(15 23 42/.06);
--sidebar-w:248px;--ease:cubic-bezier(.2,.8,.2,1);
--office-working:#0f9f86;--office-permission:#d07f0a;--office-idle:#8a96a3;--office-online:#16a34a;--office-dot:rgb(15 23 42/.08);
--office-project-1:#0891b2;--office-project-2:#9333ea;--office-project-3:#059669;--office-project-4:#2563eb;--office-project-5:#db2777;--office-project-6:#ca8a04}
@media (prefers-color-scheme:dark){:root{--background:#0b1220;--foreground:#f8fafc;--card:#111a2e;--muted:#1a2438;
--muted-foreground:#94a3b8;--destructive:#ff6568;--border:rgb(255 255 255/.07);--input:rgb(255 255 255/.15);
--ring:#3b82f6;--status-success:#86efac;--sidebar:#0e1729;--accent:rgb(37 99 235/.16);
--shadow:0 1px 2px rgb(0 0 0/.3),0 8px 24px rgb(0 0 0/.25);
--office-working:#3fc9a8;--office-permission:#f2a93b;--office-idle:#9aa6b0;--office-online:#45d16b;--office-dot:rgb(148 163 184/.13);
--office-project-1:#22d3ee;--office-project-2:#c084fc;--office-project-3:#34d399;--office-project-4:#60a5fa;--office-project-5:#f472b6;--office-project-6:#facc15}}`

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

// Work view: macro grid of devs, then one dev's tree (dev → projects → agents) joined by animated SVG cables.
const OFFICE = `.page.wide{max-width:none}
.office-stage{position:relative;display:flex;flex-direction:column;min-height:calc(100vh - 190px);
border:1px solid var(--border);border-radius:calc(var(--radius) + 4px);box-shadow:var(--shadow);overflow:hidden;
background:var(--background) radial-gradient(var(--office-dot) 1px,transparent 1px) 0 0/24px 24px}
.office-stage:fullscreen,.office-stage.tv{min-height:100vh;height:100vh;border:0;border-radius:0;box-shadow:none}
.office-stage:fullscreen .office-body,.office-stage.tv .office-body{overflow:auto}
.office-bar,.office-legend{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:8px 12px;
background:color-mix(in srgb,var(--card) 90%,transparent);backdrop-filter:blur(12px)}
.office-bar{border-bottom:1px solid var(--border);position:relative;z-index:30}
.office-title{font-size:15px}
.office-legend{border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground);padding:6px 12px}
.office-legend span{display:inline-flex;align-items:center;gap:6px}
.office-stats{font-variant-numeric:tabular-nums;color:var(--muted-foreground);font-size:13px}.office-stats b{color:var(--foreground)}
.office-tools{display:flex;align-items:center;gap:8px;margin-left:auto}.office-tools button{padding:6px 10px}
.office-seg{display:flex;padding:2px;border:1px solid var(--border);border-radius:calc(var(--radius) - 1px);background:var(--muted)}
.office-seg button{border:0;background:transparent;padding:5px 12px;font-size:13px;color:var(--muted-foreground)}
.office-seg button[aria-pressed=true]{background:var(--primary);color:var(--primary-foreground);
box-shadow:0 2px 8px color-mix(in srgb,var(--primary) 35%,transparent)}
.office-conn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted-foreground)}
.office-conn::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--office-idle)}
.office-conn[data-conn=live]::before{background:var(--office-online);animation:office-ping 2s infinite}
.office-conn[data-conn=retrying]::before{background:var(--office-permission)}
@keyframes office-ping{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--office-online) 60%,transparent)}70%,100%{box-shadow:0 0 0 6px transparent}}
.office-rotation{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:400;color:var(--muted-foreground)}
.office-switch{position:relative;width:32px;height:18px;padding:0;border-radius:999px;background:var(--muted);border-color:var(--input)}
.office-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
background:var(--muted-foreground);transition:transform .2s var(--ease)}
.office-switch[aria-checked=true]{background:var(--primary);border-color:var(--primary)}
.office-switch[aria-checked=true]::after{transform:translateX(14px);background:var(--primary-foreground)}
.office-body{position:relative;flex:1;min-height:0;padding:20px 16px 32px}
.office-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none;background:var(--office-idle)}
.office-dot.is-working{background:var(--office-working)}.office-dot.is-permission{background:var(--office-permission)}
.muted.office-none{font-size:13px}
.office-empty{display:grid;gap:4px;justify-items:center;text-align:center;padding:40px 16px;border:1px dashed var(--border);border-radius:var(--radius);grid-column:1/-1}

.office-avatar{position:relative;display:inline-block;flex:none;width:44px;height:44px;border-radius:50%;isolation:isolate}
.office-avatar.is-sm{width:22px;height:22px}.office-avatar.is-lg{width:56px;height:56px}
.office-avatar-ring{position:absolute;inset:-3px;border-radius:50%;z-index:-1;opacity:.7;filter:blur(3px);
background:conic-gradient(from 210deg,var(--brand-2),var(--brand-3),var(--brand-2));transition:opacity .25s}
.office-avatar.is-sm .office-avatar-ring{display:none}
.office-avatar-face{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;border:2px solid var(--card);
background:linear-gradient(140deg,var(--brand-2),var(--brand-3));color:#fff;font-weight:600;font-size:15px}
.office-avatar.is-sm .office-avatar-face{font-size:9px;border-width:1px}.office-avatar.is-lg .office-avatar-face{font-size:19px}
.office-avatar-status{position:absolute;right:0;bottom:0;width:12px;height:12px;border-radius:50%;border:2px solid var(--card);background:var(--office-online)}
.office-avatar.is-sm .office-avatar-status{width:8px;height:8px;border-width:1.5px}
.office-avatar.is-offline .office-avatar-status{background:var(--office-idle)}
.office-avatar.is-offline .office-avatar-face{filter:grayscale(.85);opacity:.75}.office-avatar.is-offline .office-avatar-ring{opacity:.15}

.office-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px;max-width:1440px;margin:0 auto}
.office-dev{display:grid;gap:14px;width:100%;padding:16px;text-align:left;justify-self:stretch;justify-content:stretch;align-items:start;
background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(16px);border-radius:calc(var(--radius) + 4px);box-shadow:var(--shadow);
transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease,border-color .25s ease}
.office-dev:hover{transform:translateY(-2px);filter:none;border-color:color-mix(in srgb,var(--primary) 50%,var(--border));
box-shadow:0 0 30px -10px color-mix(in srgb,var(--primary) 55%,transparent),var(--shadow)}
.office-dev.is-offline{box-shadow:none;background:color-mix(in srgb,var(--card) 55%,transparent)}
.office-dev-top{display:flex;align-items:center;gap:12px;min-width:0}.office-dev-top>div{min-width:0;display:grid}
.office-dev-name{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.office-dev-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--muted-foreground)}
.office-dev-meta span{display:inline-flex;align-items:center;gap:4px}.office-dev-meta svg.icon{width:12px;height:12px}
.office-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.office-count{display:grid;gap:1px;padding:7px 9px;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:var(--muted)}
.office-count b{font-size:18px;font-variant-numeric:tabular-nums}
.office-count span{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted-foreground);white-space:nowrap}
.office-count.is-hot{border-color:color-mix(in srgb,var(--office-permission) 55%,var(--border));background:color-mix(in srgb,var(--office-permission) 10%,var(--muted))}
.office-proj-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.office-proj-list li{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px}
.office-proj-list svg.icon{width:14px;height:14px;color:var(--muted-foreground)}
.office-proj-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.office-proj-dots{display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;max-width:50%}
.office-dev-foot{display:flex;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground)}
.office-go{color:var(--primary)}

.office-crumbs{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;padding:6px 8px;margin:0 auto 24px;max-width:1440px;
background:color-mix(in srgb,var(--card) 90%,transparent);border:1px solid var(--border);border-radius:var(--radius)}
.office-path{display:flex;align-items:center;gap:6px;min-width:0}.office-path button{color:var(--primary);padding:5px 8px}
.office-tabs{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:2px}
.office-tab{padding:3px 10px 3px 3px;border-radius:999px;font-size:12px;white-space:nowrap;flex:none}
.office-tab[aria-pressed=true]{border-color:var(--primary);background:var(--accent);color:var(--primary)}

.office-scroll{overflow-x:auto;padding-bottom:8px}
.office-tree-stage{position:relative;padding:4px 0 8px}
.office-cables,.office-ports{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.office-cables{z-index:1}.office-ports{z-index:25}
.office-tree{position:relative;z-index:2;width:max-content;transform-origin:top left}
.office-root-wrap{display:flex;justify-content:center;margin-bottom:64px}
.office-branches{display:flex;flex-wrap:nowrap;justify-content:center;align-items:flex-start;gap:28px}
.office-sub{display:flex;flex-direction:column;align-items:center}
.office-kids{display:flex;align-items:flex-start;justify-content:center;gap:12px;margin-top:46px}
.office-node{position:relative;z-index:2;display:flex;text-align:left;justify-self:auto;color:var(--foreground);
background:color-mix(in srgb,var(--card) 85%,transparent);backdrop-filter:blur(16px);border:1px solid var(--border);box-shadow:var(--shadow);
transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease,border-color .25s ease}
.office-node:hover{z-index:30;transform:translateY(-2px);filter:none;border-color:color-mix(in srgb,var(--c,var(--primary)) 65%,transparent);
box-shadow:0 0 30px -8px color-mix(in srgb,var(--c,var(--primary)) 60%,transparent),var(--shadow)}
.office-tag{display:block;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--c,var(--muted-foreground))}
.office-tag.is-primary{color:var(--primary)}
.office-root{--c:var(--primary);align-items:center;gap:14px;width:min(340px,100%);padding:14px 16px;border-radius:16px;
border:2px solid color-mix(in srgb,var(--primary) 60%,transparent);box-shadow:0 0 40px -10px color-mix(in srgb,var(--primary) 50%,transparent),var(--shadow)}
.office-root:hover .office-avatar-ring{opacity:1}
.office-root-text{display:grid;min-width:0}.office-root-text strong{font-size:16px;overflow-wrap:anywhere}
.office-root-text small,.office-project small{font-size:11px;color:var(--muted-foreground)}
.office-project{align-items:center;gap:11px;width:250px;padding:11px 13px;border-radius:14px;cursor:default;
border-color:color-mix(in srgb,var(--c) 35%,var(--border))}
.office-project-icon{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:10px;color:var(--c);
background:color-mix(in srgb,var(--c) 16%,transparent);border:1px solid color-mix(in srgb,var(--c) 35%,transparent)}
.office-project-text{display:grid;min-width:0}.office-project-text strong{font-size:14px;overflow-wrap:anywhere}
.office-agent{flex-direction:column;gap:7px;width:176px;padding:10px 11px;border-radius:12px;align-items:stretch}
.office-agent.is-permission{border-color:color-mix(in srgb,var(--office-permission) 60%,var(--border));
background:color-mix(in srgb,var(--office-permission) 8%,var(--card))}
.office-agent.is-idle{opacity:.82}
.office-agent-top{display:flex;align-items:center;gap:8px;min-width:0}
.office-agent-icon{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:8px;color:var(--c);background:color-mix(in srgb,var(--c) 15%,transparent)}
.office-agent-icon svg.icon{width:14px;height:14px}
.office-agent-name{min-width:0;font-size:13px;font-weight:600;line-height:1.25;overflow-wrap:anywhere;
display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.office-agent-meta{display:flex;align-items:center;justify-content:space-between;gap:6px}
.office-team{font-size:11px;color:var(--c)}
.office-agent.is-child{width:164px;border-style:dashed}
.office-cli{font-size:11px;padding:0 6px;border-radius:6px;background:var(--muted);border:1px solid var(--border);color:var(--muted-foreground)}
.office-agent-branch{display:flex;align-items:center;gap:4px;min-width:0;font-size:11px;color:var(--muted-foreground)}
.office-agent-branch svg.icon{width:12px;height:12px}
.office-agent-branch span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.office-agent-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding-top:7px;border-top:1px solid var(--border)}
.office-state{font-size:11px;font-weight:500;color:var(--office-idle)}
.office-state.is-working{color:var(--office-working)}.office-state.is-permission{color:var(--office-permission)}
.office-eq{display:flex;align-items:flex-end;gap:2px;height:16px}
.office-eq i{width:3px;height:16px;border-radius:1px;background:var(--c);transform-origin:bottom;animation:office-wave 1.1s ease-in-out infinite}
.office-eq i:nth-child(2){animation-delay:.12s}.office-eq i:nth-child(3){animation-delay:.24s}.office-eq i:nth-child(4){animation-delay:.36s}
.office-eq i:nth-child(5){animation-delay:.48s}.office-eq i:nth-child(6){animation-delay:.6s}.office-eq i:nth-child(7){animation-delay:.72s}
.office-agent.is-permission .office-eq i{background:var(--office-permission);animation-duration:2.4s}
.office-agent.is-idle .office-eq i{background:var(--office-idle);animation:none;transform:scaleY(.25)}
@keyframes office-wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.office-cable{fill:none;stroke:var(--c);stroke-width:2;opacity:.9}
.office-cable.is-glow{stroke-width:6;opacity:.12;filter:blur(3px)}
.office-cable.is-working{stroke-dasharray:8 8;animation:office-flow .9s linear infinite}
.office-cable.is-permission{stroke:var(--office-permission);stroke-dasharray:6 6;animation:office-flow .45s linear infinite}
.office-cable.is-idle{stroke:var(--office-idle);opacity:.35}.office-cable.is-glow.is-idle{opacity:0}
@keyframes office-flow{to{stroke-dashoffset:-32}}
.office-port{fill:var(--c);stroke:var(--background);stroke-width:2}
.office-port.is-out{filter:drop-shadow(0 0 5px var(--c))}
.office-port.is-permission{fill:var(--office-permission)}.office-port.is-idle{fill:var(--office-idle)}

.office-pill{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:500;
color:var(--office-idle);background:color-mix(in srgb,var(--office-idle) 14%,transparent)}
.office-pill.is-working{color:var(--office-working);background:color-mix(in srgb,var(--office-working) 14%,transparent)}
.office-pill.is-permission{color:var(--office-permission);background:color-mix(in srgb,var(--office-permission) 16%,transparent)}
.office-wave{display:inline-flex;align-items:flex-end;gap:2px;height:10px}
.office-wave i{width:2px;height:10px;border-radius:1px;background:currentColor;transform-origin:bottom;animation:office-wave 1.1s ease-in-out infinite}
.office-wave i:nth-child(2){animation-delay:.15s}.office-wave i:nth-child(3){animation-delay:.3s}.office-wave i:nth-child(4){animation-delay:.45s}
.office-backdrop{position:fixed;inset:0;z-index:40;background:rgb(2 6 23/.5);opacity:0;transition:opacity .2s}
.office-drawer{position:fixed;top:0;right:0;z-index:50;display:flex;flex-direction:column;width:min(420px,100%);height:100%;
background:var(--card);border-left:1px solid var(--border);box-shadow:var(--shadow);transform:translateX(100%);transition:transform .3s var(--ease)}
.drawer-open .office-backdrop{opacity:1}.drawer-open .office-drawer{transform:none}
.office-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.office-drawer-head>div{min-width:0}.office-drawer-head h2{overflow-wrap:anywhere}
.office-drawer-body{display:grid;align-content:start;gap:16px;padding:18px;overflow-y:auto}
.office-box{display:grid;gap:12px;padding:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--muted)}
.office-box.is-warn{gap:4px;border-color:color-mix(in srgb,var(--office-permission) 55%,var(--border));background:color-mix(in srgb,var(--office-permission) 9%,var(--muted))}
.office-box-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.office-label{margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.office-box-head .office-label{margin:0}
.office-kv{grid-template-columns:1fr 1fr;gap:10px 12px}.office-kv div{min-width:0}.office-kv .is-wide{grid-column:1/-1}
.office-kv dt{font-size:11px;letter-spacing:.04em;text-transform:uppercase}.office-kv dd{font-weight:500}
.office-list{display:grid;gap:8px;margin:0;padding:0;list-style:none;font-size:13px}
.office-list li{display:flex;align-items:center;gap:8px;overflow-wrap:anywhere}

.office-links{display:grid;margin:0;padding:0;list-style:none}
.office-links li{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border)}
.office-links li:first-child{border-top:0}.office-links form{display:block}
.office-new-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end}
.office-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
@media (max-width:767px){.office-new-link{grid-template-columns:1fr}.office-legend{display:none}.office-body{padding:16px 12px 24px}
.office-tools{margin-left:0}.office-fullscreen-label{display:none}
.office-tree-stage{width:100%!important;height:auto!important;padding:0}.office-tree{width:auto;transform:none!important}
.office-root-wrap{margin-bottom:36px}.office-branches{flex-direction:column;gap:22px}
.office-sub{align-items:stretch}.office-kids{flex-direction:column;gap:10px;margin:12px 0 0 22px}
.office-project,.office-agent,.office-agent.is-child{width:auto}}`


export const CONSOLE_STYLE = [TOKENS, BASE, AUTH, SHELL, MEMBERS, OFFICE].join('\n')
