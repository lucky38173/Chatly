import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://hfkdmbgovepofguvjkgd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhma2xtYmdvdmVwb2ZndXZqa2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzgwNzEsImV4cCI6MjA4OTYxNDA3MX0.vX4epLTcfVOT9KzoX3AoH7kAP_S-t6UM39vMIMDFM0k";

// FIX 1: single `sb` client — original code mixed `sb` and `supabase` (undefined) causing ReferenceError
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const MAX_CHARS     = 2000;
const EMOJI_LIST    = ["😀","😂","😍","🥰","😎","🤔","😮","😢","😡","👍","👎","❤️","🔥","✅","🚀","💡","🎉","💬","🙏","👋"];
const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];

const AI_TOOL_DEFS = [
  { id:"summarize", name:"Summarize Chat",       desc:"Quick overview of the conversation", icon:"📄" },
  { id:"reply",     name:"Draft a Reply",        desc:"Smart reply to the last message",    icon:"↩️" },
  { id:"translate", name:"Translate Last Msg",   desc:"Translate to Bengali",               icon:"🌐" },
  { id:"moderate",  name:"Moderate Content",     desc:"Check for policy violations",        icon:"🛡️" },
  { id:"actions",   name:"Extract Action Items", desc:"Find tasks and follow-ups",          icon:"✅" },
];
const LABELS = { summarize:"SUMMARY", reply:"DRAFT REPLY", translate:"TRANSLATION", moderate:"MODERATION", actions:"ACTION ITEMS" };

function genInitials(name) {
  const p = (name||"").split(" ").filter(Boolean);
  return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase();
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
function randColor() { return AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)]; }

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages:[{role:"user",content:user}] }),
  });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e?.error?.message||`API error ${res.status}`); }
  const d = await res.json();
  return d.content?.[0]?.text || "No response.";
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Instrument+Serif:ital@0;1&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0f0f13;--surface:#16161d;--surface2:#1e1e28;--surface3:#252533;
    --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.12);
    --text:#f0f0f8;--text2:#9999b8;--text3:#666688;
    --accent:#6366f1;--accent2:#818cf8;--glow:rgba(99,102,241,0.3);
    --ai:#8b5cf6;--green:#10b981;--amber:#f59e0b;--red:#ef4444;
    --font:'DM Sans',sans-serif;--serif:'Instrument Serif',serif;
    --r:14px;--rlg:20px;--shadow:0 4px 24px rgba(0,0,0,0.4);
  }
  html,body,#root{height:100%;font-family:var(--font);background:var(--bg);color:var(--text);overflow:hidden}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:2px}
  .auth{display:flex;align-items:center;justify-content:center;min-height:100dvh;background:var(--bg);position:relative;overflow:hidden}
  .auth-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 20%,rgba(99,102,241,0.12) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 80%,rgba(139,92,246,0.10) 0%,transparent 60%);pointer-events:none}
  .auth-grid{position:absolute;inset:0;opacity:0.03;background-image:linear-gradient(var(--border2) 1px,transparent 1px),linear-gradient(90deg,var(--border2) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
  .auth-card{position:relative;width:min(400px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--border2);border-radius:var(--rlg);padding:clamp(28px,6vw,48px) clamp(20px,6vw,40px);box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,0.05);animation:fadeUp .6s cubic-bezier(.16,1,.3,1) forwards}
  .auth-logo{width:52px;height:52px;background:linear-gradient(135deg,var(--accent),var(--ai));border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 0 32px var(--glow);font-size:24px}
  .auth-title{font-family:var(--serif);font-size:clamp(24px,5vw,32px);font-weight:400;line-height:1.1;margin-bottom:8px}
  .auth-title em{color:var(--accent2);font-style:italic}
  .auth-sub{color:var(--text2);font-size:14px;line-height:1.6;margin-bottom:32px;font-weight:300}
  .g-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:12px;padding:13px 20px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
  .g-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1));opacity:0;transition:opacity .2s}
  .g-btn:hover::before{opacity:1}
  .g-btn:hover:not(:disabled){border-color:var(--accent);transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,0.2)}
  .g-btn:disabled{opacity:.7;cursor:not-allowed}
  .auth-err{margin-top:12px;padding:10px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:var(--r);font-size:13px;color:#fca5a5;text-align:center}
  .auth-feats{display:flex;gap:8px;flex-direction:column;margin-top:24px}
  .auth-feat{display:flex;align-items:center;gap:10px;color:var(--text2);font-size:13px}
  .auth-feat-ico{width:20px;height:20px;border-radius:6px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
  .uname-input-wrap{position:relative;margin-bottom:8px}
  .uname-prefix{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:15px;pointer-events:none}
  .uname-input{width:100%;padding:13px 14px 13px 28px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-family:var(--font);font-size:15px;outline:none;transition:all .2s}
  .uname-input:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--glow)}
  .uname-input.err{border-color:var(--red);box-shadow:0 0 0 2px rgba(239,68,68,0.2)}
  .uname-input.ok{border-color:var(--green);box-shadow:0 0 0 2px rgba(16,185,129,0.2)}
  .uname-hint{font-size:12px;padding:4px 2px;min-height:20px}
  .uname-hint.err{color:#fca5a5}.uname-hint.ok{color:var(--green)}.uname-hint.info{color:var(--text3)}
  .confirm-btn{width:100%;padding:13px;background:linear-gradient(135deg,var(--accent),#4f46e5);border:none;border-radius:var(--r);color:white;font-family:var(--font);font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;margin-top:8px}
  .confirm-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,0.35)}
  .confirm-btn:disabled{opacity:.45;cursor:not-allowed}
  .loader{display:flex;align-items:center;justify-content:center;height:100dvh;background:var(--bg);gap:10px;color:var(--text2);font-size:14px}
  .spin{width:20px;height:20px;border-radius:50%;border:2px solid rgba(99,102,241,0.3);border-top-color:var(--accent);animation:spin .7s linear infinite}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeUp .15s ease}
  .modal{background:var(--surface);border:1px solid var(--border2);border-radius:var(--rlg);width:min(380px,100%);box-shadow:var(--shadow);overflow:hidden}
  .modal-head{padding:18px 18px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
  .modal-title{font-size:15px;font-weight:600;flex:1}
  .modal-body{padding:14px 18px 18px}
  .modal-search{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r);transition:all .2s;margin-bottom:12px}
  .modal-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px var(--glow)}
  .modal-search input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font);font-size:14px}
  .modal-search input::placeholder{color:var(--text3)}
  .modal-result{padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);display:flex;align-items:center;gap:12px;animation:fadeUp .2s ease}
  .modal-result-av{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0}
  .modal-result-name{font-size:14px;font-weight:600}
  .modal-result-uname{font-size:12px;color:var(--text3);margin-top:1px}
  .modal-add-btn{margin-left:auto;padding:7px 14px;border-radius:8px;background:var(--accent);border:none;color:white;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0}
  .modal-add-btn:hover{background:#4f46e5}
  .modal-add-btn.added{background:var(--green);cursor:default}
  .modal-empty{text-align:center;padding:24px 0;color:var(--text3);font-size:13px}
  .modal-tip{font-size:12px;color:var(--text3);line-height:1.6}
  .app{display:flex;height:100dvh;width:100vw;overflow:hidden}
  .uname-tag{font-size:10px;color:var(--text3)}
  .add-btn{width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:var(--accent2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:300;transition:all .15s;flex-shrink:0;line-height:1}
  .add-btn:hover{background:rgba(99,102,241,0.22);border-color:var(--accent);color:white}
  .sidebar{width:300px;min-width:300px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
  .sb-head{padding:13px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0}
  .sb-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sb-sub{font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ibc{width:30px;height:30px;border-radius:8px;background:transparent;border:none;color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .ibc:hover{background:var(--surface2);color:var(--text)}
  .ibc.red:hover{background:rgba(239,68,68,0.15);color:var(--red)}
  .sw{padding:10px 12px;flex-shrink:0}
  .sbox{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);transition:all .2s}
  .sbox:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px var(--glow)}
  .sbox svg{flex-shrink:0;color:var(--text3)}
  .sbox input{background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font);font-size:13px;flex:1;min-width:0}
  .sbox input::placeholder{color:var(--text3)}
  .clist{flex:1;overflow-y:auto;padding:4px 8px 8px}
  .ci{display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--r);cursor:pointer;transition:background .15s;position:relative}
  .ci:hover{background:var(--surface2)}
  .ci.on{background:rgba(99,102,241,0.12)}
  .ci.on::before{content:'';position:absolute;left:0;top:20%;bottom:20%;width:3px;background:var(--accent);border-radius:0 2px 2px 0}
  .cav{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;font-size:13px;font-weight:600}
  .sdot{position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;border:2px solid var(--surface)}
  .sdot.online{background:var(--green)}.sdot.away{background:var(--amber)}.sdot.offline{background:#55556a}
  .ci-info{flex:1;min-width:0}
  .ci-name{font-size:13px;font-weight:500;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ci-prev{font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ci-r{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
  .ci-time{font-size:11px;color:var(--text3)}
  .badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--accent);font-size:11px;font-weight:600;color:white;display:flex;align-items:center;justify-content:center}
  .no-res{padding:24px 12px;text-align:center;color:var(--text3);font-size:13px}
  .chat{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;background:var(--bg)}
  .ch{padding:13px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--surface);flex-shrink:0}
  .ch-info{flex:1;min-width:0}
  .ch-name{font-size:15px;font-weight:600}
  .ch-status{font-size:12px;color:var(--text2);margin-top:2px;display:flex;align-items:center;gap:4px}
  .back-btn{display:none;width:32px;height:32px;border-radius:9px;background:transparent;border:none;color:var(--text2);cursor:pointer;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
  .back-btn:hover{background:var(--surface2);color:var(--text)}
  .ai-btn{display:flex;align-items:center;gap:6px;padding:7px 12px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.3);border-radius:var(--r);color:var(--ai);font-family:var(--font);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;flex-shrink:0;white-space:nowrap}
  .ai-btn:hover{background:rgba(139,92,246,0.2);border-color:rgba(139,92,246,0.5)}
  .ai-btn.on{background:rgba(139,92,246,0.22);border-color:var(--ai)}
  .msgs{flex:1;overflow-y:auto;padding:16px 16px 12px;display:flex;flex-direction:column}
  .mw{display:flex;align-items:flex-end;gap:8px;position:relative}
  .mw.own{flex-direction:row-reverse}
  .mav{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0;margin-bottom:18px}
  .mm{display:flex;flex-direction:column;gap:2px;flex:0 1 70%;min-width:0}
  .bbl{padding:10px 14px;border-radius:17px;font-size:14px;line-height:1.5;overflow-wrap:break-word;align-self:flex-start;width:fit-content;max-width:100%}
  .mw.own .bbl{align-self:flex-end}
  .bbl.their{background:var(--surface2);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--text)}
  .bbl.own{background:linear-gradient(135deg,var(--accent),#4f46e5);border-bottom-right-radius:4px;color:#fff;box-shadow:0 3px 14px rgba(99,102,241,0.3)}
  .bbl.ai{background:linear-gradient(135deg,rgba(139,92,246,0.14),rgba(99,102,241,0.10));border:1px solid rgba(139,92,246,0.3);border-bottom-left-radius:4px;color:var(--text);position:relative}
  .bbl.ai::before{content:'✦ AI';position:absolute;top:-19px;left:0;font-size:10px;color:var(--ai);font-weight:600}
  .mf{display:flex;align-items:center;gap:4px;padding:0 2px}
  .mt{font-size:10px;color:var(--text3)}
  .mr{color:var(--accent2);display:flex}
  .typing-wrap{display:flex;align-items:flex-end;gap:8px;margin-top:10px}
  .typing{display:flex;align-items:center;gap:4px;padding:11px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:17px;border-bottom-left-radius:4px}
  .tdot{width:6px;height:6px;border-radius:50%;background:var(--text2);animation:pulse 1.2s ease-in-out infinite}
  .tdot:nth-child(2){animation-delay:.15s}.tdot:nth-child(3){animation-delay:.3s}
  .ddiv{display:flex;align-items:center;gap:10px;margin:10px 0 14px}
  .ddiv::before,.ddiv::after{content:'';flex:1;height:1px;background:var(--border)}
  .ddiv span{font-size:11px;color:var(--text3);font-weight:500;white-space:nowrap}
  .iarea{padding:11px 14px 13px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0;position:relative}
  .iwrap{display:flex;align-items:flex-end;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rlg);padding:6px 6px 6px 12px;transition:border-color .2s,box-shadow .2s}
  .iwrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--glow)}
  .ita{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5;resize:none;overflow-y:auto;padding:5px 0;min-height:26px}
  .ita::placeholder{color:var(--text3)}
  .ibtn{width:32px;height:32px;border-radius:9px;background:transparent;border:none;color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:18px}
  .ibtn:hover{background:var(--surface3);color:var(--text)}
  .ibtn.on{color:var(--accent)}
  .sbtn{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--accent),#4f46e5);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;box-shadow:0 2px 10px rgba(99,102,241,0.4);flex-shrink:0}
  .sbtn:hover:not(:disabled){transform:scale(1.07);box-shadow:0 4px 18px rgba(99,102,241,0.5)}
  .sbtn:active:not(:disabled){transform:scale(.96)}
  .sbtn:disabled{opacity:.32;cursor:not-allowed}
  .cc{position:absolute;top:4px;right:16px;font-size:10px;color:var(--text3);pointer-events:none}
  .cc.warn{color:var(--amber)}.cc.over{color:var(--red)}
  .epick{position:absolute;bottom:calc(100% + 4px);left:14px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--r);padding:8px;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;box-shadow:var(--shadow);z-index:100;animation:fadeUp .15s ease}
  @media(min-width:400px){.epick{grid-template-columns:repeat(10,1fr)}}
  .ebtn{width:30px;height:30px;border:none;background:transparent;cursor:pointer;font-size:16px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .1s;line-height:1}
  .ebtn:hover{background:var(--surface2)}
  .aip{width:280px;min-width:280px;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
  .aiph{padding:15px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0}
  .aipt{font-size:14px;font-weight:600;flex:1}
  .ait{padding:10px;display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1}
  .aith{padding:4px 2px 8px;font-size:11px;color:var(--text3);font-weight:500;letter-spacing:.5px;text-transform:uppercase}
  .aitb{display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--font);cursor:pointer;transition:all .15s;text-align:left;width:100%}
  .aitb:hover:not(:disabled){background:var(--surface3);border-color:rgba(139,92,246,0.35)}
  .aitb:disabled{opacity:.4;cursor:not-allowed}
  .aiti{width:28px;height:28px;border-radius:8px;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;color:var(--ai);flex-shrink:0;font-size:14px}
  .aitn{font-size:13px;font-weight:500;line-height:1.2}
  .aitd{font-size:11px;color:var(--text2);margin-top:1px}
  .airw{padding:10px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
  .airb{padding:12px;background:var(--surface2);border:1px solid rgba(139,92,246,0.25);border-radius:var(--r)}
  .airl{font-size:11px;color:var(--ai);font-weight:600;letter-spacing:.5px;display:flex;align-items:center;gap:5px;margin-bottom:8px}
  .airt{font-size:13px;line-height:1.65;color:var(--text);white-space:pre-wrap;word-break:break-word}
  .aira{display:flex;gap:6px;flex-wrap:wrap}
  .airab{padding:7px 12px;border-radius:8px;font-size:12px;font-family:var(--font);cursor:pointer;transition:all .15s;font-weight:500;border:none}
  .airab.p{background:var(--ai);color:white}.airab.p:hover{background:#7c3aed}
  .airab.a{background:var(--accent);color:white}.airab.a:hover{background:#4f46e5}
  .airab.s{background:transparent;border:1px solid var(--border2);color:var(--text2)}.airab.s:hover{background:var(--surface3);color:var(--text)}
  .aierr{padding:10px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:var(--r);font-size:13px;color:#fca5a5;line-height:1.5}
  .aild{display:flex;align-items:center;gap:8px;color:var(--ai);font-size:13px;padding:16px}
  .aidot{width:6px;height:6px;border-radius:50%;background:var(--ai);animation:pulse 1.2s ease-in-out infinite}
  .aidot:nth-child(2){animation-delay:.2s}.aidot:nth-child(3){animation-delay:.4s}
  .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
  .empty-ico{width:60px;height:60px;border-radius:18px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:4px}
  .empty-t{font-size:17px;font-weight:600;font-family:var(--serif)}
  .empty-s{font-size:13px;color:var(--text2);text-align:center;max-width:240px;line-height:1.6}
  @media(max-width:640px){
    .app{display:block;position:relative}
    .sidebar{position:absolute;inset:0;width:100%;min-width:100%;z-index:10}
    .sidebar.hide{display:none}
    .chat{position:absolute;inset:0;width:100%}
    .chat.hide{display:none}
    .aip{display:none !important}
    .back-btn{display:flex !important}
    .ai-btn span{display:none}
    .ai-btn{padding:7px 9px;gap:0}
  }
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .new{animation:msgIn .22s cubic-bezier(.16,1,.3,1) forwards}
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ico = ({d,size=20,fill="none",stroke="currentColor",sw=1.8}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
  </svg>
);
const IcoSend    = () => <Ico d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/>;
const IcoSearch  = () => <Ico d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>;
const IcoSparkle = () => <Ico d={["M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"]} fill="currentColor" stroke="none"/>;
const IcoClose   = () => <Ico d="M18 6L6 18M6 6l12 12"/>;
const IcoBack    = () => <Ico d="M19 12H5M12 5l-7 7 7 7"/>;
const IcoDone    = () => <Ico d={["M18 6L7 17l-5-5","M22 6L11 17"]} size={12}/>;
const IcoLogout  = () => <Ico d={["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","M16 17l5-5-5-5","M21 12H9"]} size={16}/>;
const IcoGoogle  = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const Dot = ({s}) => <span className={`sdot ${s||"offline"}`}/>;

// ─── USERNAME SETUP ───────────────────────────────────────────────────────────
function UsernameSetup({userId, onDone}) {
  const [val, setVal]       = useState("");
  const [status, setStatus] = useState("idle");
  const [saving, setSaving] = useState(false);
  const debounce = useRef(null);

  const check = async (v) => {
    if (!v || !/^[a-z0-9_]{3,20}$/.test(v)) { setStatus(v?"invalid":"idle"); return; }
    const {data} = await sb.from("profiles").select("id").eq("username",v).maybeSingle();
    setStatus(data ? "taken" : "ok");
  };
  const onChange = (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"");
    setVal(v); setStatus("checking");
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => check(v), 400);
  };
  const confirm = async () => {
    if (status !== "ok" || saving) return;
    setSaving(true);
    const {error} = await sb.from("profiles").update({username:val}).eq("id",userId);
    if (error) { setSaving(false); setStatus("taken"); return; }
    onDone(val);
  };
  const hints = {
    idle:{cls:"info",msg:"3–20 characters. Letters, numbers, underscore only."},
    checking:{cls:"info",msg:"Checking…"},
    invalid:{cls:"err",msg:"3–20 chars, only a–z 0–9 _"},
    taken:{cls:"err",msg:`@${val} is already taken.`},
    ok:{cls:"ok",msg:`@${val} is available ✓`},
  };
  const hint = hints[status]||hints.idle;
  return (
    <><style>{CSS}</style>
    <div className="auth"><div className="auth-bg"/><div className="auth-grid"/>
      <div className="auth-card">
        <div className="auth-logo">✦</div>
        <h1 className="auth-title">Pick a <em>username</em></h1>
        <p className="auth-sub">Others will find and add you by @username.</p>
        <div className="uname-input-wrap">
          <span className="uname-prefix">@</span>
          <input className={`uname-input${status==="ok"?" ok":status==="taken"||status==="invalid"?" err":""}`}
            value={val} onChange={onChange} onKeyDown={e=>e.key==="Enter"&&confirm()}
            placeholder="your_username" maxLength={20} autoFocus/>
        </div>
        <div className={`uname-hint ${hint.cls}`}>{hint.msg}</div>
        <button className="confirm-btn" onClick={confirm} disabled={status!=="ok"||saving}>
          {saving?"Setting up…":"Continue →"}
        </button>
      </div>
    </div></>
  );
}

// ─── ADD CONTACT MODAL ────────────────────────────────────────────────────────
function AddContactModal({onClose, onAdd, myId, existingIds}) {
  const [query,   setQuery]   = useState("");
  const [result,  setResult]  = useState(null);
  const [added,   setAdded]   = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = (v) => {
    setQuery(v); setAdded(false); setResult(null);
    const q = v.replace(/^@/,"").trim().toLowerCase();
    if (!q) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const {data} = await sb.from("profiles").select("*").eq("username",q).maybeSingle();
      setLoading(false);
      if (!data)          { setResult("not_found"); return; }
      if (data.id===myId) { setResult("self");      return; }
      setResult(data);
    }, 350);
  };

  const handleAdd = async () => {
    if (!result||typeof result==="string") return;
    const {data,error} = await sb.rpc("get_or_create_conversation",{other_user_id:result.id});
    if (!error) { onAdd({...result, convId:data}); setAdded(true); }
  };

  const alreadyAdded = result && typeof result==="object" && existingIds.includes(result.id);
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{width:30,height:30,borderRadius:9,background:"rgba(99,102,241,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>➕</div>
          <div className="modal-title">Add by Username</div>
          <button className="ibc" type="button" onClick={onClose}><IcoClose/></button>
        </div>
        <div className="modal-body">
          <div className="modal-search">
            <span style={{color:"var(--text3)",fontSize:15,flexShrink:0}}>@</span>
            <input ref={inputRef} value={query} onChange={e=>doSearch(e.target.value)} onKeyDown={e=>e.key==="Escape"&&onClose()} placeholder="username"/>
          </div>
          {!query  && <p className="modal-tip">Search by @username to start a real conversation.</p>}
          {loading && <div className="modal-empty"><div className="spin" style={{margin:"0 auto"}}/></div>}
          {!loading&&result==="not_found"&&<div className="modal-empty">😕 No user found for <strong>@{query.replace(/^@/,"")}</strong></div>}
          {!loading&&result==="self"     &&<div className="modal-empty">🙃 That's you!</div>}
          {!loading&&result&&typeof result==="object"&&(
            <div className="modal-result">
              <div className="modal-result-av" style={{background:(result.color||"#6366f1")+"22",color:result.color||"#6366f1"}}>
                {result.avatar_initials||genInitials(result.full_name)}
              </div>
              <div>
                <div className="modal-result-name">{result.full_name}</div>
                <div className="modal-result-uname">@{result.username}</div>
              </div>
              {alreadyAdded||added
                ?<button className="modal-add-btn added" disabled>✓ Added</button>
                :<button className="modal-add-btn" onClick={handleAdd}>Add</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session,   setSession]   = useState(undefined);
  const [profile,   setProfile]   = useState(null);
  const [convs,     setConvs]     = useState([]);
  const [activeId,  setActiveId]  = useState(null);
  const [draft,     setDraft]     = useState("");
  const [search,    setSearch]    = useState("");
  const [aiOpen,    setAiOpen]    = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult,  setAiResult]  = useState(null);
  const [aiError,   setAiError]   = useState(null);
  const [aiTask,    setAiTask]    = useState(null);
  const [emoji,     setEmoji]     = useState(false);
  const [addOpen,   setAddOpen]   = useState(false);
  const [authErr,   setAuthErr]   = useState(null);

  const endRef       = useRef(null);
  const taRef        = useRef(null);
  const emojiBtn     = useRef(null);
  const emojiPick    = useRef(null);
  const aiLoadingRef = useRef(false);
  const realtimeSub  = useRef(null);
  // FIX 3: mirror activeId in ref so realtime callbacks always see current value
  const activeIdRef  = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const conv = useMemo(() => convs.find(c=>c.id===activeId)||null, [convs, activeId]);
  const myId = profile?.id || session?.user?.id;

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({data:{session:s}}) => setSession(s));
    const {data:{subscription}} = sb.auth.onAuthStateChange((_,s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Load profile ──────────────────────────────────────────────────────────
  // FIX 5: depend on session user id (stable string) not session object
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfile(null); setConvs([]); return; }
    sb.from("profiles").select("*").eq("id",uid).single().then(({data}) => setProfile(data));
  }, [session?.user?.id]);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) return;

    // FIX 1: use `sb` everywhere (was `supabase` which is undefined)
    const {data:parts} = await sb.from("participants").select("conversation_id").eq("user_id",uid);
    if (!parts?.length) { setConvs([]); return; }

    const convIds = parts.map(p=>p.conversation_id);
    const {data:allParts} = await sb.from("participants")
      .select("conversation_id, user_id, profiles(*)")
      .in("conversation_id", convIds)
      .neq("user_id", uid);

    // FIX 6: ascending order so messages render in correct chronological order
    const {data:allMsgs} = await sb.from("messages")
      .select("*").in("conversation_id",convIds).order("created_at",{ascending:true});

    const convMap = {};
    (allParts||[]).forEach(p => {
      const contact = p.profiles;
      if (!contact) return;
      const msgs = (allMsgs||[]).filter(m=>m.conversation_id===p.conversation_id);
      convMap[p.conversation_id] = {
        id: p.conversation_id,
        contact: {
          id: contact.id, name: contact.full_name, username: contact.username,
          initials: contact.avatar_initials||genInitials(contact.full_name),
          color: contact.color||randColor(), status: contact.status||"offline",
          avatar_url: contact.avatar_url,
        },
        messages: msgs.map(m=>({
          id:m.id, from:m.sender_id, text:m.content, isAi:m.is_ai,
          time:fmtTime(m.created_at), timestamp:new Date(m.created_at).getTime(), read:true,
        })),
      };
    });
    setConvs(Object.values(convMap));
  }, [profile?.id]);

  useEffect(() => { if (profile?.id) loadConversations(); }, [profile?.id, loadConversations]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  // FIX 7: stable key — only re-subscribe when the set of conv IDs changes
  const convIdsKey = useMemo(() => convs.map(c=>c.id).sort().join(","), [convs]);

  useEffect(() => {
    if (!profile?.id || !convs.length) return;
    const convIds = convs.map(c=>c.id);

    realtimeSub.current?.unsubscribe();
    // FIX 8: unique channel name per user prevents collisions
    realtimeSub.current = sb.channel(`msgs_${profile.id}`)
      .on("postgres_changes",
        {event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=in.(${convIds.join(",")})`},
        (payload) => {
          const m = payload.new;
          // FIX 9: ignore own messages (already added via optimistic update)
          if (m.sender_id === profile.id) return;
          const isActive = activeIdRef.current === m.conversation_id;
          setConvs(prev => prev.map(c => {
            if (c.id !== m.conversation_id) return c;
            // FIX 10: dedup — Supabase can deliver the same event twice
            if (c.messages.some(x=>x.id===m.id)) return c;
            const newMsg = {
              id:m.id, from:m.sender_id, text:m.content, isAi:m.is_ai,
              time:fmtTime(m.created_at), timestamp:new Date(m.created_at).getTime(),
              read: isActive, isNew: true,
            };
            return {...c, messages:[...c.messages, newMsg]};
          }));
        })
      .subscribe();

    return () => { realtimeSub.current?.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, convIdsKey]);

  // ── Scroll + emoji + conv switch ──────────────────────────────────────────
  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [conv?.messages?.length]);

  useEffect(() => {
    if (!emoji) return;
    const h = (e) => { if(!emojiBtn.current?.contains(e.target)&&!emojiPick.current?.contains(e.target)) setEmoji(false); };
    document.addEventListener("mousedown",h);
    return () => document.removeEventListener("mousedown",h);
  }, [emoji]);

  useEffect(() => {
    if (!activeId) return;
    setDraft(""); setEmoji(false);
    setAiResult(null); setAiError(null); setAiTask(null);
    if (taRef.current) taRef.current.style.height="auto";
    // Mark messages as read
    setConvs(prev => prev.map(c => {
      if (c.id!==activeId||!c.messages.some(m=>!m.read&&m.from!==myId)) return c;
      return {...c, messages: c.messages.map(m => m.from!==myId ? {...m,read:true} : m)};
    }));
  }, [activeId, myId]);

  // ── Send (optimistic) ─────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (!draft.trim()||!activeId||draft.length>MAX_CHARS||!profile) return;
    const text = draft.trim();
    const tempId = `temp_${Date.now()}`;
    const tempMsg = { id:tempId, from:profile.id, text, isAi:false, time:fmtTime(Date.now()), timestamp:Date.now(), read:true, isNew:true };
    setConvs(prev => prev.map(c => c.id===activeId ? {...c,messages:[...c.messages,tempMsg]} : c));
    setDraft(""); setEmoji(false);
    if (taRef.current) { taRef.current.style.height="auto"; taRef.current.focus(); }

    const {data,error} = await sb.from("messages")
      .insert({conversation_id:activeId, sender_id:profile.id, content:text})
      .select().single();

    if (error) {
      // Rollback on error
      setConvs(prev => prev.map(c => c.id===activeId ? {...c,messages:c.messages.filter(m=>m.id!==tempId)} : c));
      return;
    }
    // Replace temp with real DB record
    setConvs(prev => prev.map(c => {
      if (c.id!==activeId) return c;
      return {...c, messages: c.messages.map(m => m.id===tempId ? {
        id:data.id, from:data.sender_id, text:data.content, isAi:data.is_ai,
        time:fmtTime(data.created_at), timestamp:new Date(data.created_at).getTime(), read:true, isNew:true,
      } : m)};
    }));
  }, [draft, activeId, profile]);

  const onKey = useCallback((e) => {
    if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); send(); }
    if (e.key==="Escape") setEmoji(false);
  }, [send]);

  const onTA = (e) => {
    setDraft(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
  };

  const insertEmoji = (em) => {
    const ta=taRef.current; if(!ta){setDraft(d=>d+em);return;}
    const s=ta.selectionStart??draft.length, e=ta.selectionEnd??draft.length;
    setDraft(draft.slice(0,s)+em+draft.slice(e));
    requestAnimationFrame(()=>{
      if(!taRef.current)return;
      const p=s+[...em].length;
      taRef.current.selectionStart=p; taRef.current.selectionEnd=p;
      taRef.current.style.height="auto"; taRef.current.style.height=Math.min(taRef.current.scrollHeight,120)+"px";
      taRef.current.focus();
    });
  };

  // ── AI ────────────────────────────────────────────────────────────────────
  const runAI = useCallback(async (tid) => {
    if (!conv||aiLoadingRef.current) return;
    aiLoadingRef.current=true; setAiLoading(true); setAiResult(null); setAiError(null); setAiTask(tid);
    const hist = conv.messages.map(m=>`${m.from===profile?.id?(profile.full_name||"Me"):conv.contact.name}: ${m.text}`).join("\n");
    const TASKS = {
      summarize:{sys:"Summarize this conversation in 2-3 clear sentences.",usr:`<chat>\n${hist}\n</chat>\n\nSummarize.`},
      reply:{sys:"Draft a short natural reply (1-2 sentences). Output only the reply.",usr:`<chat>\n${hist}\n</chat>\n\nDraft a reply to the last message from ${conv.contact.name}.`},
      translate:{sys:"Translate only the last message to Bengali. Output only the translation.",usr:`<chat>\n${hist}\n</chat>\n\nTranslate the last message to Bengali.`},
      moderate:{sys:"Analyze for harmful content. Reply:\nSTATUS: CLEAN|WARNING|FLAGGED\nReason: one sentence.",usr:`<chat>\n${hist}\n</chat>\n\nAnalyze.`},
      actions:{sys:"Extract action items as a numbered list. If none, say 'No action items found.'",usr:`<chat>\n${hist}\n</chat>\n\nList all action items.`},
    };
    try { const r=await callClaude(TASKS[tid].sys,TASKS[tid].usr); setAiResult(r); }
    catch(e){ setAiError(e.message||"Unable to connect to Claude AI."); }
    finally { aiLoadingRef.current=false; setAiLoading(false); }
  }, [conv, profile]);

  const useReply = useCallback(() => {
    if (!aiResult) return;
    const t=aiResult; setAiResult(null);setAiTask(null);setAiError(null);setDraft(t);
    requestAnimationFrame(()=>{ if(!taRef.current)return; taRef.current.style.height="auto"; taRef.current.style.height=Math.min(taRef.current.scrollHeight,120)+"px"; taRef.current.focus(); });
  }, [aiResult]);

  const sendAI = useCallback(async () => {
    if (!aiResult||!activeId||!profile) return;
    await sb.from("messages").insert({conversation_id:activeId, sender_id:profile.id, content:aiResult, is_ai:true});
    setAiResult(null); setAiTask(null); setAiError(null);
  }, [aiResult, activeId, profile]);

  // FIX 11: navigate to new conversation immediately after adding
  const addContact = useCallback(async (user) => {
    const existing = convs.find(c=>c.contact.id===user.id);
    if (existing) { setActiveId(existing.id); setAddOpen(false); return; }
    await loadConversations();
    setAddOpen(false);
    if (user.convId) setActiveId(user.convId);
  }, [convs, loadConversations]);

  const logout = async () => {
    realtimeSub.current?.unsubscribe();
    setAiOpen(false); setAiResult(null); setAiTask(null); setAiError(null); setAddOpen(false);
    await sb.auth.signOut();
    setConvs([]); setActiveId(null); setDraft(""); setSearch("");
  };

  const googleLogin = async () => {
    setAuthErr(null);
    const {error} = await sb.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo: "https://chatly-by-soyeb.netlify.app"},
    });
    if (error) setAuthErr(error.message);
  };

  const unread = useMemo(() => {
    const map={};
    convs.forEach(c=>{ const n=c.messages.filter(m=>!m.read&&m.from!==myId).length; if(n>0)map[c.id]=n; });
    return map;
  }, [convs, myId]);

  const filteredConvs = useMemo(() => {
    const q=search.toLowerCase();
    return convs
      .filter(c=>!q||c.contact.name?.toLowerCase().includes(q)||c.contact.username?.toLowerCase().includes(q)||c.messages[c.messages.length-1]?.text?.toLowerCase().includes(q))
      .sort((a,b)=>(b.messages[b.messages.length-1]?.timestamp||0)-(a.messages[a.messages.length-1]?.timestamp||0));
  }, [convs, search]);

  const cc=draft.length, showCC=cc>MAX_CHARS*0.7;

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (session===undefined) return <><style>{CSS}</style><div className="loader"><div className="spin"/><span>Loading…</span></div></>;

  if (!session) return (
    <><style>{CSS}</style>
    <div className="auth"><div className="auth-bg"/><div className="auth-grid"/>
      <div className="auth-card">
        <div className="auth-logo">💬</div>
        <h1 className="auth-title">Welcome to <em>Chatly</em></h1>
        <p className="auth-sub">Real-time messaging powered by Claude AI.</p>
        <button className="g-btn" onClick={googleLogin}><IcoGoogle/><span>Continue with Google</span></button>
        {authErr&&<div className="auth-err">⚠ {authErr}</div>}
        <div className="auth-feats">
          {[["✦","AI summaries & smart replies"],["💬","Real-time messaging"],["🌍","Translation to Bengali"],["👤","Username-based contact add"]].map(([i,t])=>(
            <div key={t} className="auth-feat"><div className="auth-feat-ico">{i}</div><span>{t}</span></div>
          ))}
        </div>
      </div>
    </div></>
  );

  if (!profile||!profile.username) return (
    <UsernameSetup userId={session.user.id} onDone={async () => {
      const {data} = await sb.from("profiles").select("*").eq("id",session.user.id).single();
      setProfile(data);
    }}/>
  );

  return (
    <><style>{CSS}</style>
    <div className="app">

      {/* SIDEBAR */}
      <div className={`sidebar${activeId?" hide":""}`}>
        <div className="sb-head">
          <div style={{width:36,height:36,borderRadius:10,background:(profile.color||"#6366f1")+"22",border:`1px solid ${profile.color||"#6366f1"}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:profile.color||"#6366f1",flexShrink:0,overflow:"hidden"}}>
            {profile.avatar_url
              ?<img src={profile.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:10}} onError={e=>e.target.style.display="none"} alt=""/>
              :(profile.avatar_initials||genInitials(profile.full_name))}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="sb-name">{profile.full_name}</div>
            <div className="sb-sub"><span className="uname-tag">@{profile.username}</span></div>
          </div>
          <button className="add-btn" type="button" title="Add contact" onClick={()=>setAddOpen(true)}>+</button>
          <button className="ibc red" type="button" title="Sign out" onClick={logout}><IcoLogout/></button>
        </div>
        <div className="sw">
          <div className="sbox">
            <IcoSearch/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search conversations…"/>
            {search&&<button type="button" style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",padding:0,display:"flex"}} onClick={()=>setSearch("")}><IcoClose/></button>}
          </div>
        </div>
        <div className="clist">
          {filteredConvs.length===0&&<div className="no-res">{search?"No results":"No conversations yet. Add someone with +"}</div>}
          {filteredConvs.map(c=>{
            const last=c.messages[c.messages.length-1];
            const badge=unread[c.id];
            return (
              <div key={c.id} className={`ci${activeId===c.id?" on":""}`} onClick={()=>setActiveId(c.id)}>
                <div className="cav" style={{background:(c.contact.color||"#6366f1")+"22",border:`1px solid ${c.contact.color||"#6366f1"}33`,color:c.contact.color||"#6366f1"}}>
                  {c.contact.initials||"??"}
                  <Dot s={c.contact.status}/>
                </div>
                <div className="ci-info">
                  <div className="ci-name" style={{fontWeight:badge?700:500}}>{c.contact.name}</div>
                  <div className="ci-prev">{last?.from===myId?"You: ":""}{last?.text||"No messages yet"}</div>
                </div>
                <div className="ci-r">
                  {last&&<div className="ci-time">{last.time}</div>}
                  {badge?<div className="badge">{badge}</div>:null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT */}
      {conv?(
        <div className="chat">
          <div className="ch">
            <button className="back-btn" type="button" onClick={()=>setActiveId(null)}><IcoBack/></button>
            <div style={{width:38,height:38,borderRadius:12,background:(conv.contact.color||"#6366f1")+"22",border:`1px solid ${conv.contact.color||"#6366f1"}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:conv.contact.color||"#6366f1",flexShrink:0,position:"relative"}}>
              {conv.contact.initials||"??"}
              <Dot s={conv.contact.status}/>
            </div>
            <div className="ch-info">
              <div className="ch-name">{conv.contact.name}</div>
              <div className="ch-status">
                <span style={{width:6,height:6,borderRadius:"50%",background:conv.contact.status==="online"?"var(--green)":conv.contact.status==="away"?"var(--amber)":"var(--text3)",display:"inline-block",flexShrink:0}}/>
                {conv.contact.status==="online"?"Active now":conv.contact.status==="away"?"Away":"Offline"}
                {conv.contact.username&&<span style={{marginLeft:6,color:"var(--text3)",fontSize:11}}>@{conv.contact.username}</span>}
              </div>
            </div>
            <button className={`ai-btn${aiOpen?" on":""}`} type="button" onClick={()=>setAiOpen(o=>!o)}>
              <IcoSparkle/><span>{aiOpen?"Hide AI":"AI Tools"}</span>
            </button>
          </div>

          <div className="msgs">
            <div className="ddiv"><span>{conv.messages.length} messages</span></div>
            {conv.messages.map((msg,i)=>{
              const own=msg.from===myId;
              const grp=i>0&&conv.messages[i-1].from===msg.from;
              return (
                <div key={msg.id} className={`mw${own?" own":""}${msg.isNew?" new":""}`} style={{marginTop:grp?2:10}}>
                  {!own&&<div className="mav" style={{background:(conv.contact.color||"#6366f1")+"22",color:conv.contact.color||"#6366f1",visibility:grp?"hidden":"visible"}}>{conv.contact.initials}</div>}
                  <div className="mm">
                    <div className={`bbl ${own?"own":msg.isAi?"ai":"their"}`}>
                      {msg.text.split("\n").map((line,li,arr)=><span key={li}>{line}{li<arr.length-1&&<br/>}</span>)}
                    </div>
                    <div className="mf">
                      <span className="mt">{msg.time}{msg.isAi?" · ✦ AI":""}</span>
                      {own&&<span className="mr"><IcoDone/></span>}
                    </div>
                  </div>
                  {own&&<div className="mav" style={{background:(profile.color||"#6366f1")+"22",color:profile.color||"#6366f1",visibility:grp?"hidden":"visible"}}>{profile.avatar_initials||genInitials(profile.full_name)}</div>}
                </div>
              );
            })}
            <div ref={endRef}/>
          </div>

          <div className="iarea">
            {showCC&&<div className={`cc${cc>MAX_CHARS?" over":cc>MAX_CHARS*0.9?" warn":""}`}>{cc}/{MAX_CHARS}</div>}
            {emoji&&<div className="epick" ref={emojiPick}>{EMOJI_LIST.map(e=><button key={e} className="ebtn" type="button" onClick={()=>insertEmoji(e)}>{e}</button>)}</div>}
            <div className="iwrap">
              <button ref={emojiBtn} className={`ibtn${emoji?" on":""}`} type="button" onClick={()=>setEmoji(s=>!s)}>😊</button>
              <textarea ref={taRef} className="ita" placeholder={`Message ${conv.contact.name}…`} value={draft} onChange={onTA} onKeyDown={onKey} rows={1}/>
              <button className="sbtn" type="button" onClick={send} disabled={!draft.trim()||draft.length>MAX_CHARS}><IcoSend/></button>
            </div>
          </div>
        </div>
      ):(
        <div className="chat hide">
          <div className="empty">
            <div className="empty-ico">💬</div>
            <div className="empty-t">Select a conversation</div>
            <div className="empty-s">Add someone with the + button, or pick a conversation to start chatting.</div>
          </div>
        </div>
      )}

      {/* AI PANEL */}
      {aiOpen&&conv&&(
        <div className="aip">
          <div className="aiph">
            <div style={{width:26,height:26,borderRadius:7,background:"rgba(139,92,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--ai)",flexShrink:0}}><IcoSparkle/></div>
            <div className="aipt">Claude AI Tools</div>
            <button className="ibc" type="button" onClick={()=>{setAiOpen(false);setAiResult(null);setAiTask(null);setAiError(null);}}><IcoClose/></button>
          </div>
          {aiLoading?(<div className="aild"><div className="aidot"/><div className="aidot"/><div className="aidot"/><span>Claude is thinking…</span></div>)
          :aiError?(<div className="airw"><div className="aierr">⚠ {aiError}</div><div className="aira"><button className="airab p" type="button" onClick={()=>runAI(aiTask)}>Retry</button><button className="airab s" type="button" onClick={()=>{setAiError(null);setAiTask(null);}}>← Back</button></div></div>)
          :aiResult?(<div className="airw"><div className="airb"><div className="airl"><IcoSparkle/>{LABELS[aiTask]??"RESULT"}</div><div className="airt">{aiResult}</div></div><div className="aira">{aiTask==="reply"&&<><button className="airab p" type="button" onClick={useReply}>Edit &amp; Send</button><button className="airab a" type="button" onClick={sendAI}>Send Now</button></>}<button className="airab s" type="button" onClick={()=>{setAiResult(null);setAiTask(null);}}>← Back</button></div></div>)
          :(<div className="ait"><div className="aith">{conv.messages.length} messages · {conv.contact.name}</div>{AI_TOOL_DEFS.map(t=>(<button key={t.id} className="aitb" type="button" disabled={aiLoading} onClick={()=>runAI(t.id)}><div className="aiti">{t.icon}</div><div><div className="aitn">{t.name}</div><div className="aitd">{t.desc}</div></div></button>))}</div>)}
        </div>
      )}

      {addOpen&&<AddContactModal onClose={()=>setAddOpen(false)} onAdd={addContact} myId={myId} existingIds={convs.map(c=>c.contact.id)}/>}
    </div></>
  );
}
