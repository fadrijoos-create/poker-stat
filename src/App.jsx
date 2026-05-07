import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_KEY = "poker_stat_state_v5";
const SESSION_KEY = "poker_stat_session_v5";
const LEGACY_STORAGE_KEYS = [
  "poker_stat_state_v4",
  "poker_stat_state_v3",
  "poker_stat_state_v2",
  "poker_stat_state_v1",
];
const LEGACY_SESSION_KEYS = [
  "poker_stat_session_v4",
  "poker_stat_session_v3",
  "poker_stat_session_v2",
  "poker_stat_session_v1",
];

const COLORS = [
  "#22c55e",
  "#60a5fa",
  "#f97316",
  "#a855f7",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
  "#ec4899",
  "#38bdf8",
  "#84cc16",
];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const emptyState = () => {
  const groupId = uid();
  return {
    admin: { username: "admin", password: "admin123" },
    currentGroupId: groupId,
    groups: [
      {
        id: groupId,
        name: "Meine Pokergruppe",
        players: [],
        sessions: [],
      },
    ],
  };
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const loadState = () => {
  if (typeof window === "undefined") return emptyState();

  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) continue;
      const parsed = safeParse(stored);
      if (parsed?.groups?.length) return parsed;
    } catch {
      // ignore and try next key
    }
  }

  return emptyState();
};

const loadSession = () => {
  if (typeof window === "undefined") return null;

  for (const key of [SESSION_KEY, ...LEGACY_SESSION_KEYS]) {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) continue;
      const parsed = safeParse(stored);
      if (parsed) return parsed;
    } catch {
      // ignore and try next key
    }
  }

  return null;
};

const fmtCHF = (value) => {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(0)} CHF`;
};

const fmtNum = (value) => {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(0)}`;
};

const fmtDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
};

const Card = ({ title, subtitle, children, className = "" }) => (
  <div className={`rounded-[1.75rem] bg-slate-900/80 border border-slate-800 shadow-2xl ${className}`}>
    <div className="p-5 md:p-6 border-b border-slate-800/80">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle ? <div className="text-sm text-slate-400 mt-1">{subtitle}</div> : null}
    </div>
    <div className="p-5 md:p-6">{children}</div>
  </div>
);

const StatTile = ({ label, value, tone = "emerald" }) => {
  const toneClass =
    tone === "sky"
      ? "text-sky-400"
      : tone === "violet"
      ? "text-violet-400"
      : tone === "amber"
      ? "text-amber-400"
      : tone === "red"
      ? "text-red-400"
      : "text-emerald-400";

  return (
    <div className="rounded-[1.75rem] bg-slate-900/80 border border-slate-800 shadow-xl p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-sm text-slate-400 text-center leading-6">
    {text}
  </div>
);

const MiniStat = ({ label, value, positive }) => (
  <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className={`font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>{value}</div>
  </div>
);

function useSvgSize(ref, fallback = { width: 800, height: 420 }) {
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    if (!ref.current) return;
    const update = () => {
      const rect = ref.current.getBoundingClientRect();
      setSize({
        width: Math.max(320, rect.width),
        height: Math.max(260, rect.height),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function LineGraph({ series, labels }) {
  const ref = React.useRef(null);
  const { width, height } = useSvgSize(ref);

  const margin = { top: 20, right: 20, bottom: 40, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const minVal = allValues.length ? Math.min(0, ...allValues) : 0;
  const maxVal = allValues.length ? Math.max(0, ...allValues) : 1;
  const range = maxVal - minVal || 1;

  const xFor = (index, total) => {
    if (total <= 1) return margin.left + plotW / 2;
    return margin.left + (index / (total - 1)) * plotW;
  };

  const yFor = (value) => margin.top + ((maxVal - value) / range) * plotH;

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => maxVal - (range / yTicks) * i);

  return (
    <div ref={ref} className="w-full h-full">
      <svg width={width} height={height} className="overflow-visible">
        {tickValues.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#1f2937" strokeDasharray="4 4" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => {
          const x = xFor(i, labels.length);
          return (
            <g key={label + i}>
              <line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke="#0f172a" strokeDasharray="2 6" />
              <text x={x} y={height - 14} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmtDate(label)}
              </text>
            </g>
          );
        })}

        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="#334155" />
        <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} stroke="#334155" />

        {series.map((s, sIndex) => {
          const points = s.points.map((p, i) => `${xFor(i, labels.length)},${yFor(p.value)}`).join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.key}>
              <polyline fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
              {last ? <circle cx={xFor(s.points.length - 1, labels.length)} cy={yFor(last.value)} r="4" fill={s.color} /> : null}
              <text x={margin.left + 12} y={24 + sIndex * 18} fill={s.color} fontSize="12">
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarGraph({ data }) {
  const ref = React.useRef(null);
  const { width, height } = useSvgSize(ref, { width: 800, height: 320 });
  const margin = { top: 20, right: 16, bottom: 42, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const values = data.map((d) => d.value);
  const minVal = values.length ? Math.min(0, ...values) : 0;
  const maxVal = values.length ? Math.max(0, ...values) : 1;
  const range = maxVal - minVal || 1;
  const yFor = (value) => margin.top + ((maxVal - value) / range) * plotH;
  const zeroY = yFor(0);
  const barW = data.length ? Math.max(14, Math.min(48, (plotW / data.length) * 0.65)) : 18;
  const gap = data.length ? plotW / data.length : 0;
  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => maxVal - (range / yTicks) * i);

  return (
    <div ref={ref} className="w-full h-full">
      <svg width={width} height={height}>
        {tickValues.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#1f2937" strokeDasharray="4 4" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} stroke="#334155" />
        <line x1={margin.left} x2={width - margin.right} y1={zeroY} y2={zeroY} stroke="#475569" />

        {data.map((d, i) => {
          const cx = margin.left + gap * i + gap / 2;
          const valueY = yFor(d.value);
          const rectY = d.value >= 0 ? valueY : zeroY;
          const rectH = Math.max(2, Math.abs(zeroY - valueY));
          const fill = d.skipped ? "#334155" : d.value >= 0 ? "#22c55e" : "#ef4444";
          return (
            <g key={d.label + i}>
              <rect x={cx - barW / 2} y={rectY} width={barW} height={rectH} rx="7" fill={fill} />
              <text x={cx} y={height - 14} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmtDate(d.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [session, setSession] = useState(loadSession);
  const [view, setView] = useState("dashboard");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedGraphPlayerId, setSelectedGraphPlayerId] = useState("");
  const [draft, setDraft] = useState({});
  const [newGroupName, setNewGroupName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [fullscreenGraph, setFullscreenGraph] = useState(false);
const [visiblePlayers, setVisiblePlayers] = useState([]);
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState(supabase ? "Verbinde mit Supabase…" : "Lokaler Modus aktiv");
  const [syncError, setSyncError] = useState("");

  const isAdmin = session?.role === "admin";
  const isGuest = session?.role === "guest";

  const currentGroup = useMemo(() => {
    const found = state.groups.find((g) => g.id === state.currentGroupId);
    return found || state.groups[0];
  }, [state]);

  const currentGroupId = currentGroup?.id || "";
  const players = currentGroup?.players || [];
  const sessions = useMemo(
    () => [...(currentGroup?.sessions || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [currentGroup]
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const loadFromSupabase = async () => {
      if (!supabase) {
        setSyncReady(true);
        return;
      }

      try {
        setSyncStatus("Lade Online-Speicher…");
        const { data, error } = await supabase
          .from("poker_stat_state")
          .select("payload")
          .eq("id", "main")
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data?.payload?.groups?.length) {
          setState(data.payload);
          setSyncStatus("Online-Speicher geladen");
        } else {
          await supabase.from("poker_stat_state").upsert({
            id: "main",
            payload: state,
            updated_at: new Date().toISOString(),
          });
          setSyncStatus("Online-Speicher erstellt");
        }
      } catch (err) {
        if (!cancelled) {
          setSyncError(err?.message || "Supabase Fehler");
          setSyncStatus("Lokaler Modus aktiv");
        }
      } finally {
        if (!cancelled) setSyncReady(true);
      }
    };

    loadFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!syncReady || !supabase) return;

    const timer = setTimeout(async () => {
      try {
        setSyncError("");
        setSyncStatus("Speichere online…");
        const { error } = await supabase.from("poker_stat_state").upsert({
          id: "main",
          payload: state,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        setSyncStatus("Online gespeichert");
      } catch (err) {
        setSyncError(err?.message || "Supabase Speichern fehlgeschlagen");
        setSyncStatus("Lokale Sicherung aktiv");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [state, syncReady]);

  useEffect(() => {
    if (!selectedSessionId && sessions.length) setSelectedSessionId(sessions[sessions.length - 1].id);
    if (selectedSessionId && !sessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[sessions.length - 1]?.id || "");
    }
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    if (players.length && !selectedGraphPlayerId) setSelectedGraphPlayerId(players[0].id);
  }, [players, selectedGraphPlayerId]);
  useEffect(() => {
  if (players.length && visiblePlayers.length === 0) {
    setVisiblePlayers(players.map((p) => p.id));
  }
}, [players]);
useEffect(() => {
  if (players.length && visiblePlayers.length === 0) {
    setVisiblePlayers(players.map((p) => p.id));
  }
}, [players, visiblePlayers.length]);
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || sessions[sessions.length - 1] || null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    if (!selectedSession) return;
    const next = {};
    players.forEach((p) => {
      const r = selectedSession.results.find((x) => x.playerId === p.id);
      next[p.id] = {
        buyIn: r?.buyIn ?? 0,
        cashOut: r?.cashOut ?? 0,
        amount: r?.amount ?? 0,
        skipped: r?.skipped ?? false,
      };
    });
    setDraft(next);
  }, [selectedSessionId, currentGroupId, players, selectedSession]);

  const stats = useMemo(() => {
    const map = new Map();
    players.forEach((p) => {
      map.set(p.id, { total: 0, played: 0, avgTotal: 0, avgPlayed: 0, best: null, worst: null });
    });

    sessions.forEach((sessionItem, sessionIndex) => {
      sessionItem.results.forEach((r) => {
        const row = map.get(r.playerId);
        if (!row || r.skipped) return;
        const amount = Number(r.amount || 0);
        row.total += amount;
        row.played += 1;
        row.best = row.best === null ? amount : Math.max(row.best, amount);
        row.worst = row.worst === null ? amount : Math.min(row.worst, amount);
        if (sessionIndex > 0) {
          row.avgTotal += amount;
          row.avgPlayed += 1;
        }
      });
    });

    return players.map((p) => {
      const r = map.get(p.id) || { total: 0, played: 0, avgTotal: 0, avgPlayed: 0, best: 0, worst: 0 };
      return {
        ...p,
        total: r.total,
        played: r.played,
        avg: r.avgPlayed > 0 ? r.avgTotal / r.avgPlayed : 0,
        best: r.best ?? 0,
        worst: r.worst ?? 0,
      };
    });
  }, [players, sessions]);

  const leaderboardTotal = [...stats].sort((a, b) => b.total - a.total);
  const leaderboardAverage = [...stats].sort((a, b) => b.avg - a.avg);

  const cumulativeSeries = useMemo(() => {
    const running = {};
    players.forEach((p) => (running[p.id] = 0));

    return players.map((p, index) => {
      const points = sessions.map((s) => {
        const r = s.results.find((x) => x.playerId === p.id);
        const delta = r && !r.skipped ? Number(r.amount || 0) : 0;
        running[p.id] += delta;
        return { label: s.date, value: running[p.id] };
      });

      return {
        key: p.id,
        name: p.name,
        color: COLORS[index % COLORS.length],
        points,
      };
    });
  }, [players, sessions]);
const filteredSeries = cumulativeSeries.filter((s) =>
  visiblePlayers.includes(s.key)
);
  const playerBars = useMemo(() => {
    if (!selectedGraphPlayerId) return [];
    return sessions.map((s) => {
      const r = s.results.find((x) => x.playerId === selectedGraphPlayerId);
      return {
        label: s.date,
        value: r && !r.skipped ? Number(r.amount || 0) : 0,
        skipped: !r || r.skipped,
      };
    });
  }, [sessions, selectedGraphPlayerId]);

  const currentPlayer = players.find((p) => p.id === selectedGraphPlayerId) || players[0] || null;
  const currentPlayerStats = currentPlayer ? stats.find((s) => s.id === currentPlayer.id) : null;
  const totalGroupProfit = leaderboardTotal.reduce((sum, p) => sum + p.total, 0);
  const selectedSessionBalance = useMemo(() => {
    if (!selectedSession) return 0;
    return selectedSession.results.reduce((sum, r) => sum + (r.skipped ? 0 : Number(r.amount || 0)), 0);
  }, [selectedSession]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setAuthError("");
    if (adminUser === state.admin.username && adminPassword === state.admin.password) {
      setSession({ role: "admin", name: adminUser });
      setView("dashboard");
      return;
    }
    setAuthError("Admin-Zugang ist nicht korrekt.");
  };

  const enterGuest = () => setSession({ role: "guest", name: "Gast" });

  const logout = () => setSession(null);

  const switchGroup = (groupId) => {
    setState((prev) => ({ ...prev, currentGroupId: groupId }));
    setSelectedSessionId("");
    setSelectedGraphPlayerId("");
  };

  const addGroup = () => {
    if (!isAdmin || !newGroupName.trim()) return;
    const id = uid();
    setState((prev) => ({
      ...prev,
      currentGroupId: id,
      groups: [...prev.groups, { id, name: newGroupName.trim(), players: [], sessions: [] }],
    }));
    setNewGroupName("");
    setView("groups");
  };

  const addPlayer = () => {
    if (!isAdmin || !newPlayerName.trim()) return;
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === currentGroupId ? { ...g, players: [...g.players, { id: uid(), name: newPlayerName.trim() }] } : g
      ),
    }));
    setNewPlayerName("");
  };

  const removePlayer = (playerId) => {
    if (!isAdmin) return;
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== currentGroupId) return g;
        return {
          ...g,
          players: g.players.filter((p) => p.id !== playerId),
          sessions: g.sessions.map((s) => ({
            ...s,
            results: s.results.filter((r) => r.playerId !== playerId),
          })),
        };
      }),
    }));
  };

  const addSession = () => {
    if (!isAdmin || !newSessionTitle.trim()) return;
    const sessionObj = {
      id: uid(),
      title: newSessionTitle.trim(),
      date: newSessionDate,
      results: players.map((p) => ({
        playerId: p.id,
        buyIn: 0,
        cashOut: 0,
        amount: 0,
        skipped: true,
      })),
    };
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === currentGroupId ? { ...g, sessions: [...g.sessions, sessionObj] } : g)),
    }));
    setSelectedSessionId(sessionObj.id);
    setNewSessionTitle("");
    setView("sessions");
  };

  const saveDraft = () => {
    if (!isAdmin || !selectedSession) return;
    const updated = {
      ...selectedSession,
      results: players.map((p) => {
        const entry = draft[p.id] || {};
        const buyIn = Number(entry.buyIn || 0);
        const cashOut = Number(entry.cashOut || 0);

        return {
          playerId: p.id,
          buyIn,
          cashOut,
          amount: cashOut - buyIn,
          skipped: Boolean(entry.skipped),
        };
      }),
    };
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === currentGroupId ? { ...g, sessions: g.sessions.map((s) => (s.id === updated.id ? updated : s)) } : g
      ),
    }));
    setSelectedSessionId(updated.id);
  };

  const updateSessionDate = (sessionId, date) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === currentGroupId
          ? {
              ...g,
              sessions: g.sessions.map((s) => (s.id === sessionId ? { ...s, date } : s)),
            }
          : g
      ),
    }));
  };

  const deleteSession = (sessionId) => {
    if (!isAdmin) return;
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === currentGroupId ? { ...g, sessions: g.sessions.filter((s) => s.id !== sessionId) } : g
      ),
    }));
    if (selectedSessionId === sessionId) setSelectedSessionId("");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.10),_transparent_35%)] flex items-center justify-center p-4">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 shadow-2xl p-7 md:p-8">
              <div className="text-xs uppercase tracking-[0.35em] text-emerald-400 mb-4">Poker Stat</div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">Poker-Tracking für deine Gruppe</h1>
              <p className="mt-4 text-slate-300 text-base md:text-lg leading-7 max-w-xl">
                Sessions, Leaderboards und Graphen — sauber auf dem Handy nutzbar, mit Admin-Bearbeitung und einer Ansicht für alle anderen.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-7">
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Mehrere Gruppen</div>
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Admin mit Passwort</div>
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Spieler ohne Login ansehen</div>
                <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Gruppen- und Spielergraphen</div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 shadow-2xl p-7 md:p-8">
              <div className="flex gap-2 mb-6">
                <button type="button" onClick={() => setView("dashboard")} className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-slate-950">
                  Vorschau
                </button>
                <button type="button" onClick={enterGuest} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-200">
                  Ohne Login ansehen
                </button>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Admin-Benutzername</label>
                  <input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Passwort</label>
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none focus:border-emerald-500" />
                </div>
                {authError ? <div className="text-sm text-red-400">{authError}</div> : null}
                <button className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">
                  Als Admin anmelden
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-emerald-400">Poker Stat</div>
            <div className="text-lg font-semibold">{currentGroup?.name || "Keine Gruppe"}</div>
            <div className="text-xs text-slate-400 mt-1">
              {syncStatus}
              {syncError ? ` · ${syncError}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-sm px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
              Eingeloggt als <span className="text-emerald-400 font-medium">{session.name}</span>
              {isAdmin ? " · Admin" : isGuest ? " · Ansicht" : ""}
            </div>
            <button onClick={() => setView("dashboard")} className={`px-4 py-2 rounded-xl ${view === "dashboard" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>
              Dashboard
            </button>
            <button onClick={() => setView("sessions")} className={`px-4 py-2 rounded-xl ${view === "sessions" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>
              Sessions
            </button>
            {isAdmin ? (
              <button onClick={() => setView("groups")} className={`px-4 py-2 rounded-xl ${view === "groups" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>
                Gruppen
              </button>
            ) : null}
            <button onClick={logout} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {view === "dashboard" ? (
          <>
            <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <StatTile label="Gesamtgewinn" value={fmtCHF(totalGroupProfit)} />
              <StatTile label="Spieler" value={players.length} tone="sky" />
              <StatTile label="Sessions" value={sessions.length} tone="violet" />
              <StatTile label="Gruppen" value={state.groups.length} tone="amber" />
              <StatTile label="Session-Balance" value={selectedSessionBalance === 0 ? "Passt" : fmtCHF(selectedSessionBalance)} tone={selectedSessionBalance === 0 ? "emerald" : "red"} />
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <Card title="Leaderboard · Gesamtgewinn" subtitle="Sortiert nach gesamtem Gewinn/Verlust.">
                {leaderboardTotal.length ? (
                  <div className="space-y-3">
                    {leaderboardTotal.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                          <button onClick={() => { setSelectedGraphPlayerId(p.id); setView("dashboard"); }} className="hover:text-emerald-400">
                            {p.name}
                          </button>
                        </div>
                        <div className={p.total >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(p.total)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Noch keine Spieler vorhanden." />
                )}
              </Card>

              <Card title="Leaderboard · Gewinn pro Spiel" subtitle="Die erste Session zählt nicht für diesen Durchschnitt.">
                {leaderboardAverage.length ? (
                  <div className="space-y-3">
                    {leaderboardAverage.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                          <button onClick={() => { setSelectedGraphPlayerId(p.id); setView("dashboard"); }} className="hover:text-emerald-400">
                            {p.name}
                          </button>
                        </div>
                        <div className={p.avg >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(p.avg)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Noch keine Spieler vorhanden." />
                )}
              </Card>
            </section>

            <section className="grid xl:grid-cols-3 gap-6">
              <Card title="Gruppen-Graph" subtitle="Kumulierte Entwicklung über Datum in CHF." className="xl:col-span-2">
                {sessions.length && players.length ? (
                  <div
  className="h-[420px] cursor-pointer"
  onClick={() => setFullscreenGraph(true)}
>
  <LineGraph
    series={filteredSeries}
    labels={sessions.map((s) => s.date)}
  />
</div>
                ) : (
                  <EmptyState text="Erstelle erst eine Session, damit der Graph sichtbar wird." />
                )}
              </Card>

              <Card title="Spielerprofil" subtitle="Klicke einen Spieler an, um seine Statistik zu sehen.">
                {players.length ? (
                  <>
                    <select value={selectedGraphPlayerId} onChange={(e) => setSelectedGraphPlayerId(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none mb-4">
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      <MiniStat label="Gesamt" value={fmtCHF(currentPlayerStats?.total || 0)} positive={(currentPlayerStats?.total || 0) >= 0} />
                      <MiniStat label="Ø / Spiel" value={fmtCHF(currentPlayerStats?.avg || 0)} positive={(currentPlayerStats?.avg || 0) >= 0} />
                      <MiniStat label="Spiele" value={currentPlayerStats?.played || 0} positive />
                      <MiniStat label="Bestes Spiel" value={fmtNum(currentPlayerStats?.best || 0)} positive={(currentPlayerStats?.best || 0) >= 0} />
                    </div>
                    <div className="h-[280px]">
                      {playerBars.length ? <BarGraph data={playerBars} /> : <EmptyState text="Noch keine Sessions für diesen Spieler." />}
                    </div>
                  </>
                ) : (
                  <EmptyState text="Noch keine Spieler vorhanden." />
                )}
              </Card>
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <Card title="Letzte Sessions" subtitle="Schneller Überblick über deine letzten Runden.">
                {sessions.length ? (
                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {[...sessions].reverse().map((s) => (
                      <button key={s.id} onClick={() => { setView("sessions"); setSelectedSessionId(s.id); }} className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 hover:border-emerald-500/60">
                        <div className="font-semibold">{s.title}</div>
                        <div className="text-sm text-slate-400">{fmtDate(s.date)}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Noch keine Sessions vorhanden." />
                )}
              </Card>

              <Card title="Geld-Kontrolle" subtitle="So erkennst du sofort, ob die Session aufgeht.">
                <div className={`rounded-2xl border px-4 py-4 ${selectedSessionBalance === 0 ? "border-emerald-500 bg-emerald-500/10" : "border-amber-500 bg-amber-500/10"}`}>
                  <div className="text-sm text-slate-300">Aktuell ausgewählte Session</div>
                  <div className="mt-1 text-lg font-semibold">
                    {selectedSessionBalance === 0 ? "Ausgeglichen" : `Abweichung ${fmtCHF(selectedSessionBalance)}`}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Wenn die Session korrekt ist, gleichen die positiven und negativen Beträge sich aus.
                  </div>
                </div>
              </Card>

              {isAdmin ? (
                <Card title="Neue Session" subtitle="Nur für den Admin sichtbar.">
                  <div className="space-y-3">
                    <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Titel" className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                    <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                    <button onClick={addSession} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Session anlegen</button>
                  </div>
                </Card>
              ) : (
                <Card title="Hinweis" subtitle="Gastansicht">Nur der Admin kann neue Sessions anlegen oder bearbeiten.</Card>
              )}
            </section>
          </>
        ) : null}

        {view === "sessions" ? (
          <section className="grid xl:grid-cols-3 gap-6">
            <Card title="Sessions" subtitle="Session auswählen und ansehen.">
              {sessions.length ? (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className={`rounded-2xl border px-4 py-3 ${selectedSessionId === s.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}>
                      <button onClick={() => setSelectedSessionId(s.id)} className="w-full text-left">
                        <div className="font-semibold">{s.title}</div>
                        <div className="text-sm text-slate-400">{fmtDate(s.date)}</div>
                      </button>
                      {isAdmin ? <button onClick={() => deleteSession(s.id)} className="mt-3 text-sm text-red-400 hover:text-red-300">Session löschen</button> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Noch keine Sessions vorhanden." />
              )}
            </Card>

            <Card title={selectedSession ? `Session · ${selectedSession.title}` : "Session ansehen"} subtitle={selectedSession ? fmtDate(selectedSession.date) : "Wähle links eine Session aus."} className="xl:col-span-2">
              {selectedSession ? (
                isAdmin ? (
                  <>
                    <div
                      className={`mb-4 rounded-2xl border px-4 py-3 ${
                        selectedSessionBalance === 0
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-amber-500 bg-amber-500/10"
                      }`}
                    >
                      <div className="font-semibold">
                        {selectedSessionBalance === 0 ? "Diese Session ist ausgeglichen." : `Diese Session ist um ${fmtCHF(selectedSessionBalance)} nicht ausgeglichen.`}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Titel</label>
                        <input
                          value={selectedSession.title}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              groups: prev.groups.map((g) =>
                                g.id === currentGroupId
                                  ? { ...g, sessions: g.sessions.map((s) => (s.id === selectedSession.id ? { ...s, title: e.target.value } : s)) }
                                  : g
                              ),
                            }))
                          }
                          className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-2">Datum</label>
                        <input
                          type="date"
                          value={selectedSession.date}
                          onChange={(e) => updateSessionDate(selectedSession.id, e.target.value)}
                          className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <button onClick={saveDraft} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Speichern</button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {players.map((p, idx) => {
                        const d = draft[p.id] || { buyIn: 0, cashOut: 0, skipped: false };
                        const delta = Number(d.cashOut || 0) - Number(d.buyIn || 0);
                        return (
                          <div key={p.id} className="grid md:grid-cols-[170px_1fr_1fr_120px_150px] gap-3 items-center rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold">{idx + 1}</div>
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className={delta >= 0 ? "text-emerald-400 text-sm" : "text-red-400 text-sm"}>{fmtNum(delta)}</div>
                              </div>
                            </div>

                            <input
                              type="number"
                              step="1"
                              disabled={Boolean(d.skipped)}
                              value={d.buyIn}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] || { skipped: false }),
                                    buyIn: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none disabled:opacity-60"
                              placeholder="Buy-In"
                            />

                            <input
                              type="number"
                              step="1"
                              disabled={Boolean(d.skipped)}
                              value={d.cashOut}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...(prev[p.id] || { skipped: false }),
                                    cashOut: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none disabled:opacity-60"
                              placeholder="Cash-Out"
                            />

                            <div className={`text-center font-semibold ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtCHF(delta)}
                            </div>

                            <label className="flex items-center gap-3 text-sm text-slate-300 justify-start md:justify-end">
                              <input
                                type="checkbox"
                                checked={Boolean(d.skipped)}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [p.id]: { ...(prev[p.id] || { buyIn: 0, cashOut: 0 }), skipped: e.target.checked },
                                  }))
                                }
                                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                              />
                              Nicht teilgenommen
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {players.map((p) => {
                      const r = selectedSession.results.find((x) => x.playerId === p.id);
                      const amount = r && !r.skipped ? Number(r.amount || 0) : 0;
                      return (
                        <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                          <div>{p.name}</div>
                          <div className={amount >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                            {r?.skipped ? "Nicht teilgenommen" : fmtCHF(amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <EmptyState text="Noch keine Session ausgewählt." />
              )}
            </Card>

            {isAdmin ? (
              <Card title="Neue Session" subtitle="Session hinzufügen und danach Einträge erfassen.">
                <div className="space-y-3">
                  <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} placeholder="Titel" className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                  <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                  <button onClick={addSession} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Session anlegen</button>
                </div>
              </Card>
            ) : (
              <Card title="Hinweis" subtitle="Gastansicht">Nur der Admin kann Sessions bearbeiten.</Card>
            )}
          </section>
        ) : null}

        {view === "groups" && isAdmin ? (
          <section className="grid xl:grid-cols-3 gap-6">
            <Card title="Gruppen" subtitle="Zwischen mehreren Gruppen wechseln.">
              <div className="space-y-2">
                {state.groups.map((g) => (
                  <button key={g.id} onClick={() => switchGroup(g.id)} className={`w-full text-left rounded-2xl border px-4 py-3 ${g.id === currentGroupId ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-slate-400">
                      {g.players.length} Spieler · {g.sessions.length} Sessions
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Neue Gruppe" subtitle="Nur für den Admin sichtbar.">
              <div className="space-y-3">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Gruppenname" className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                <button onClick={addGroup} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Gruppe anlegen</button>
              </div>
            </Card>

            <Card title="Spieler" subtitle="Spieler hinzufügen oder entfernen.">
              <div className="space-y-3">
                {players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <span>{p.name}</span>
                    <button onClick={() => removePlayer(p.id)} className="text-sm text-red-400 hover:text-red-300">Entfernen</button>
                  </div>
                ))}
                <div className="pt-2 space-y-3">
                  <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Neuer Spielername" className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                  <button onClick={addPlayer} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Spieler anlegen</button>
                </div>
              </div>
            </Card>
          </section>
        ) : null}

        {view === "groups" && !isAdmin ? (
          <Card title="Hinweis" subtitle="Nur für den Admin.">
            Nur der Admin kann Gruppen bearbeiten. Alle anderen können Dashboard und Sessions ansehen.
          </Card>
        ) : null}
      {fullscreenGraph && (
  <div className="fixed inset-0 z-50 bg-black/90 p-6">
    <div className="h-full w-full bg-slate-900 rounded-3xl p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="text-2xl font-bold">
          Gruppen-Graph
        </div>

        <button
          onClick={() => setFullscreenGraph(false)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700"
        >
          Schliessen
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setVisiblePlayers(players.map((p) => p.id))}
          className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950"
        >
          Alle
        </button>

        {players.map((p) => {
          const active = visiblePlayers.includes(p.id);

          return (
            <button
              key={p.id}
              onClick={() => {
                if (active) {
                  setVisiblePlayers(
                    visiblePlayers.filter((id) => id !== p.id)
                  );
                } else {
                  setVisiblePlayers([...visiblePlayers, p.id]);
                }
              }}
              className={`px-3 py-2 rounded-xl ${
                active
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex-1">
        <LineGraph
          series={filteredSeries}
          labels={sessions.map((s) => s.date)}
        />
      </div>
    </div>
  </div>
)}</main>
    </div>
  );
}
