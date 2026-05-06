import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STORAGE_KEY = "poker_stat_state_v4";
const SESSION_KEY = "poker_stat_session_v4";
const LEGACY_STORAGE_KEYS = ["poker_stat_state_v3", "poker_stat_state_v2", "poker_stat_state_v1"];
const LEGACY_SESSION_KEYS = ["poker_stat_session_v3", "poker_stat_session_v2", "poker_stat_session_v1"];

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

const loadState = () => {
  if (typeof window === "undefined") return emptyState();
  try {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.groups?.length) return parsed;
    }
  } catch {
    // ignore
  }
  return emptyState();
};

const loadSession = () => {
  if (typeof window === "undefined") return null;
  try {
    for (const key of [SESSION_KEY, ...LEGACY_SESSION_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // ignore
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

const colors = ["#22c55e", "#60a5fa", "#f97316", "#a855f7", "#f43f5e", "#14b8a6", "#eab308", "#ec4899"];

function Panel({ title, children }) {
  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl">
      <div className="text-lg font-semibold mb-4">{title}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value, tone = "emerald" }) {
  const toneClass =
    tone === "red"
      ? "text-red-400"
      : tone === "sky"
      ? "text-sky-400"
      : tone === "violet"
      ? "text-violet-400"
      : "text-emerald-400";
  return (
    <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl">
      <div className="text-sm text-slate-400 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [session, setSession] = useState(loadSession);
  const [loginMode, setLoginMode] = useState("admin");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState("dashboard");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedGraphPlayerId, setSelectedGraphPlayerId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState({});

  const currentGroup = useMemo(() => state.groups.find((g) => g.id === state.currentGroupId) || state.groups[0], [state]);
  const currentGroupId = currentGroup?.id || "";
  const players = currentGroup?.players || [];
  const sessions = useMemo(() => [...(currentGroup?.sessions || [])].sort((a, b) => a.date.localeCompare(b.date)), [currentGroup]);
  const isAdmin = session?.role === "admin";
  const isGuest = session?.role === "guest";

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    if (!selectedSessionId && sessions.length) setSelectedSessionId(sessions[sessions.length - 1].id);
    if (selectedSessionId && !sessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[sessions.length - 1]?.id || "");
    }
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    if (players.length && !selectedGraphPlayerId) setSelectedGraphPlayerId(players[0].id);
  }, [players, selectedGraphPlayerId]);

  const selectedSession = useMemo(() => sessions.find((s) => s.id === selectedSessionId) || sessions[sessions.length - 1] || null, [sessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSession) return;
    const next = {};
    players.forEach((p) => {
      const r = selectedSession.results.find((x) => x.playerId === p.id);
      next[p.id] = { amount: r?.amount ?? 0, skipped: r?.skipped ?? false };
    });
    setDraft(next);
  }, [selectedSessionId, currentGroupId]);

  const stats = useMemo(() => {
    const map = new Map();
    players.forEach((p) => map.set(p.id, { total: 0, played: 0, avgTotal: 0, avgPlayed: 0, best: null, worst: null }));

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

  const groupChartData = useMemo(() => {
    const running = {};
    players.forEach((p) => {
      running[p.id] = 0;
    });

    return sessions.map((s) => {
      const row = { date: s.date, title: s.title };
      players.forEach((p) => {
        const r = s.results.find((x) => x.playerId === p.id);
        const delta = r && !r.skipped ? Number(r.amount || 0) : 0;
        running[p.id] += delta;
        row[p.id] = running[p.id];
      });
      return row;
    });
  }, [players, sessions]);

  const playerBars = useMemo(() => {
    if (!selectedGraphPlayerId) return [];
    return sessions.map((s) => {
      const r = s.results.find((x) => x.playerId === selectedGraphPlayerId);
      return { date: s.date, title: s.title, value: r && !r.skipped ? Number(r.amount || 0) : 0 };
    });
  }, [sessions, selectedGraphPlayerId]);

  const currentPlayer = players.find((p) => p.id === selectedGraphPlayerId) || players[0] || null;
  const currentPlayerStats = currentPlayer ? stats.find((s) => s.id === currentPlayer.id) : null;

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError("");
    if (adminUser === state.admin.username && adminPassword === state.admin.password) {
      setSession({ role: "admin", name: adminUser });
      return;
    }
    setAuthError("Admin-Zugang ist nicht korrekt.");
  };

  const enterGuest = () => {
    setSession({ role: "guest", name: "Gast" });
  };

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
  };

  const addPlayer = () => {
    if (!isAdmin || !newPlayerName.trim()) return;
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === currentGroupId ? { ...g, players: [...g.players, { id: uid(), name: newPlayerName.trim() }] } : g)),
    }));
    setNewPlayerName("");
  };

  const addSession = () => {
    if (!isAdmin || !newSessionTitle.trim()) return;
    const sessionObj = {
      id: uid(),
      title: newSessionTitle.trim(),
      date: newSessionDate,
      results: players.map((p) => ({ playerId: p.id, amount: 0, skipped: true })),
    };
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === currentGroupId ? { ...g, sessions: [...g.sessions, sessionObj] } : g)),
    }));
    setSelectedSessionId(sessionObj.id);
    setNewSessionTitle("");
  };

  const saveDraft = () => {
    if (!isAdmin || !selectedSession) return;
    const updated = {
      ...selectedSession,
      results: players.map((p) => ({
        playerId: p.id,
        amount: Number(draft[p.id]?.amount ?? 0),
        skipped: Boolean(draft[p.id]?.skipped),
      })),
    };
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === currentGroupId ? { ...g, sessions: g.sessions.map((s) => (s.id === updated.id ? updated : s)) } : g)),
    }));
  };

  const deleteSession = (sessionId) => {
    if (!isAdmin) return;
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === currentGroupId ? { ...g, sessions: g.sessions.filter((s) => s.id !== sessionId) } : g)),
    }));
    if (selectedSessionId === sessionId) setSelectedSessionId("");
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

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-2xl">
            <div className="text-sm uppercase tracking-widest text-emerald-400 mb-2">Poker Stat</div>
            <h1 className="text-3xl font-bold mb-3">Poker-Tracking für deine Gruppe</h1>
            <p className="text-slate-300 leading-6 mb-6">Sessions, Leaderboards und Graphen. Admin kann bearbeiten, alle anderen schauen direkt an.</p>
            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Mehrere Gruppen</div>
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Admin mit Passwort</div>
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Spieler ohne Login ansehen</div>
              <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4">• Gruppen- und Spielergraphen</div>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-2xl">
            <div className="flex gap-2 mb-6">
              <button type="button" onClick={() => setLoginMode("admin")} className={`px-4 py-2 rounded-xl text-sm font-medium ${loginMode === "admin" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-200"}`}>Admin</button>
              <button type="button" onClick={enterGuest} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 text-slate-200">Ohne Login ansehen</button>
            </div>

            <form onSubmit={handleLogin}>
              <label className="block text-sm text-slate-300 mb-2">Admin-Benutzername</label>
              <input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none mb-4" />
              <label className="block text-sm text-slate-300 mb-2">Passwort</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
              {authError ? <div className="mt-4 text-sm text-red-400">{authError}</div> : null}
              <button className="mt-6 w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Als Admin anmelden</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-400">Poker Stat</div>
            <div className="text-lg font-semibold">{currentGroup?.name || "Keine Gruppe"}</div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-sm px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
              Eingeloggt als <span className="text-emerald-400 font-medium">{session.name}</span>
              {isAdmin ? " · Admin" : isGuest ? " · Ansicht" : ""}
            </div>
            <button onClick={() => setView("dashboard")} className={`px-4 py-2 rounded-xl ${view === "dashboard" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>Dashboard</button>
            <button onClick={() => setView("sessions")} className={`px-4 py-2 rounded-xl ${view === "sessions" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>Sessions</button>
            {isAdmin ? <button onClick={() => setView("groups")} className={`px-4 py-2 rounded-xl ${view === "groups" ? "bg-emerald-500 text-slate-950" : "bg-slate-900 border border-slate-800"}`}>Gruppen</button> : null}
            <button onClick={logout} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">Logout</button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {view === "dashboard" ? (
          <>
            <section className="grid md:grid-cols-4 gap-4">
              <StatCard label="Gesamtgewinn" value={fmtCHF(leaderboardTotal.reduce((sum, p) => sum + p.total, 0))} />
              <StatCard label="Spieler" value={players.length} tone="sky" />
              <StatCard label="Sessions" value={sessions.length} tone="violet" />
              <StatCard label="Gruppen" value={state.groups.length} tone="emerald" />
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <Panel title="Leaderboard · Gesamtgewinn">
                <div className="space-y-3">
                  {leaderboardTotal.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                        <span>{p.name}</span>
                      </div>
                      <div className={p.total >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(p.total)}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Leaderboard · Gewinn pro Spiel">
                <div className="text-xs text-slate-400 mb-3">Die erste Session zählt für diesen Durchschnitt nicht.</div>
                <div className="space-y-3">
                  {leaderboardAverage.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold">{idx + 1}</div>
                        <span>{p.name}</span>
                      </div>
                      <div className={p.avg >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(p.avg)}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <Panel title="Gruppen-Graph">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={groupChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" tickFormatter={(v) => `${v} CHF`} />
                      <Tooltip labelFormatter={(v) => `Datum: ${fmtDate(v)}`} />
                      <Legend />
                      {players.map((p, i) => (
                        <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Spielerprofil">
                {currentPlayer ? (
                  <>
                    <div className="mb-4">
                      <select value={selectedGraphPlayerId} onChange={(e) => setSelectedGraphPlayerId(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none">
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                        <div className="text-xs text-slate-400">Gesamt</div>
                        <div className={currentPlayerStats?.total >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(currentPlayerStats?.total || 0)}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                        <div className="text-xs text-slate-400">Ø / Spiel</div>
                        <div className={currentPlayerStats?.avg >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>{fmtCHF(currentPlayerStats?.avg || 0)}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                        <div className="text-xs text-slate-400">Spiele</div>
                        <div className="font-semibold">{currentPlayerStats?.played || 0}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3">
                        <div className="text-xs text-slate-400">Bestes Spiel</div>
                        <div className="font-semibold">{fmtNum(currentPlayerStats?.best || 0)}</div>
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={playerBars}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip labelFormatter={(v) => `Datum: ${fmtDate(v)}`} formatter={(v) => [`${v} CHF`, "Session"]} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {playerBars.map((entry, index) => (
                              <Cell key={index} fill={entry.value >= 0 ? "#22c55e" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : null}
              </Panel>

              <Panel title="Letzte Sessions">
                <div className="space-y-3">
                  {[...sessions].reverse().map((s) => (
                    <button key={s.id} onClick={() => { setView("sessions"); setSelectedSessionId(s.id); }} className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 hover:border-emerald-500/60">
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm text-slate-400">{fmtDate(s.date)}</div>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>
          </>
        ) : null}

        {view === "sessions" ? (
          <section className="grid xl:grid-cols-3 gap-6">
            <Panel title="Sessions">
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className={`rounded-2xl border px-4 py-3 ${selectedSessionId === s.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}>
                    <button onClick={() => setSelectedSessionId(s.id)} className="w-full text-left">
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm text-slate-400">{fmtDate(s.date)}</div>
                    </button>
                    {isAdmin ? <button onClick={() => deleteSession(s.id)} className="mt-3 text-sm text-red-400">Session löschen</button> : null}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={`Session ${selectedSession ? `· ${selectedSession.title} · ${fmtDate(selectedSession.date)}` : ""}`}>
              {selectedSession ? (
                <>
                  {isAdmin ? (
                    <>
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
                            onChange={(e) =>
                              setState((prev) => ({
                                ...prev,
                                groups: prev.groups.map((g) =>
                                  g.id === currentGroupId
                                    ? { ...g, sessions: g.sessions.map((s) => (s.id === selectedSession.id ? { ...s, date: e.target.value } : s)) }
                                    : g
                                ),
                              }))
                            }
                            className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <button onClick={saveDraft} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Speichern</button>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {players.map((p, idx) => {
                          const d = draft[p.id] || { amount: 0, skipped: false };
                          return (
                            <div key={p.id} className="grid md:grid-cols-[180px_1fr_150px] gap-3 items-center rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold">{idx + 1}</div>
                                <div>
                                  <div className="font-medium">{p.name}</div>
                                  <div className={Number(d.amount) >= 0 ? "text-emerald-400 text-sm" : "text-red-400 text-sm"}>{fmtNum(d.amount)}</div>
                                </div>
                              </div>
                              <label className="flex items-center gap-3 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(d.skipped)}
                                  onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] || { amount: 0 }), skipped: e.target.checked } }))}
                                  className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                                />
                                Nicht teilgenommen
                              </label>
                              <input
                                type="number"
                                step="1"
                                disabled={Boolean(d.skipped)}
                                value={d.amount}
                                onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] || { skipped: false }), amount: e.target.value } }))}
                                className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none disabled:opacity-60"
                                placeholder="0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3 text-slate-300">
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
                  )}
                </>
              ) : (
                <div className="text-slate-400">Noch keine Session ausgewählt.</div>
              )}
            </Panel>

            {isAdmin ? (
              <Panel title="Neue Session">
                <div className="space-y-3">
                  <input value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" placeholder="Titel" />
                  <input type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" />
                  <button onClick={addSession} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Session anlegen</button>
                </div>
              </Panel>
            ) : null}
          </section>
        ) : null}

        {view === "groups" && isAdmin ? (
          <section className="grid xl:grid-cols-3 gap-6">
            <Panel title="Gruppen">
              <div className="space-y-2">
                {state.groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => switchGroup(g.id)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 ${g.id === currentGroupId ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}
                  >
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-slate-400">{g.players.length} Spieler · {g.sessions.length} Sessions</div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Neue Gruppe">
              <div className="space-y-3">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" placeholder="Gruppenname" />
                <button onClick={addGroup} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Gruppe anlegen</button>
              </div>
            </Panel>

            <Panel title="Spieler">
              <div className="space-y-3">
                {players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <span>{p.name}</span>
                    <button onClick={() => removePlayer(p.id)} className="text-sm text-red-400">Entfernen</button>
                  </div>
                ))}
                <div className="pt-2 space-y-3">
                  <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none" placeholder="Neuer Spielername" />
                  <button onClick={addPlayer} className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-3">Spieler anlegen</button>
                </div>
              </div>
            </Panel>
          </section>
        ) : null}

        {view === "groups" && !isAdmin ? (
          <Panel title="Hinweis">Nur der Admin kann Gruppen bearbeiten. Alle anderen können Dashboard und Sessions ansehen.</Panel>
        ) : null}
      </main>
    </div>
  );
}
