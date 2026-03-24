import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GiBackpack } from "react-icons/gi";
import useSWR from "swr";

import { ItemSlot, LevelRing, LogoBox, PulseRow } from "../ui/primitives";
import { fmtK } from "../ui/utils";

// ── Match detail modal ────────────────────────────────────────────────────────

const STAT_TABS = ["KDA", "Farm", "Damage", "Items"];

export function PlayerTableRow({ player }) {
  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/60 transition-colors">
      {/* PLAYER: wide hero portrait + hero name + steam name */}
      <td className="px-2 py-1.5 min-w-45">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-16 h-9 shrink-0 rounded-sm overflow-hidden bg-zinc-800">
            {player.hero.img && (
              <img src={player.hero.img} alt={player.hero.name} className="w-full h-full object-cover object-top" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-zinc-200 truncate leading-tight">{player.hero.name || "—"}</span>
            {(player.proName || player.personaname) && (
              <span className="text-[9px] text-zinc-500 truncate leading-tight">
                {player.proName ?? player.personaname}
              </span>
            )}
          </div>
        </div>
      </td>
      {/* LVL */}
      <td className="text-center px-1 w-9">
        <div className="flex justify-center">
          <LevelRing level={player.level} />
        </div>
      </td>
      {/* K */}
      <td className="text-center px-1 w-8 text-[11px] font-semibold text-emerald-400 tabular-nums">{player.kills}</td>
      {/* D */}
      <td className="text-center px-1 w-8 text-[11px] font-semibold text-red-400 tabular-nums">{player.deaths}</td>
      {/* A */}
      <td className="text-center px-1 w-8 text-[11px] text-zinc-300 tabular-nums">{player.assists}</td>
      {/* LH / DN */}
      <td className="text-center px-1 w-14 text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">{player.lastHits}/{player.denies}</td>
      {/* NET */}
      <td className="text-center px-1 w-14 text-[11px] font-semibold text-amber-400 tabular-nums">{fmtK(player.netWorth)}</td>
      {/* GPM / XPM */}
      <td className="text-center px-1 w-16 text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">{player.gpm}/{player.xpm}</td>
      {/* HD */}
      <td className="text-center px-1 w-14 text-[10px] text-zinc-400 tabular-nums">{fmtK(player.heroDamage)}</td>
      {/* TD */}
      <td className="text-center px-1 w-12 text-[10px] text-zinc-500 tabular-nums">{player.towerDamage > 0 ? fmtK(player.towerDamage) : "—"}</td>
      {/* ITEMS: 6 main + neutral + backpack row */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          {player.items.map((item, i) => <ItemSlot key={i} item={item} />)}
          {player.neutral && (
            <>
              <div className="w-px h-4 bg-zinc-700 mx-1 shrink-0" />
              <ItemSlot item={player.neutral} size="sm" rounded />
            </>
          )}
        </div>
        {player.backpack?.some(Boolean) && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <GiBackpack className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-0.5" />
            {player.backpack.map((item, i) => <ItemSlot key={i} item={item} size="sm" />)}
          </div>
        )}
      </td>
    </tr>
  );
}

export function TeamTable({ players, team }) {
  const totals = players.reduce(
    (acc, p) => ({
      kills:       acc.kills       + p.kills,
      deaths:      acc.deaths      + p.deaths,
      assists:     acc.assists     + p.assists,
      lastHits:    acc.lastHits    + p.lastHits,
      denies:      acc.denies      + p.denies,
      netWorth:    acc.netWorth    + p.netWorth,
      heroDamage:  acc.heroDamage  + p.heroDamage,
      towerDamage: acc.towerDamage + p.towerDamage,
    }),
    { kills: 0, deaths: 0, assists: 0, lastHits: 0, denies: 0, netWorth: 0, heroDamage: 0, towerDamage: 0 },
  );

  const thCls = "px-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-center whitespace-nowrap";

  return (
    <div>
      {/* Team header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-700 ${team.isRadiant ? "bg-emerald-950/60" : "bg-red-950/60"}`}>
        <LogoBox src={team.logo} size="sm" />
        <span className="text-sm font-bold text-white">{team.name}</span>
        {team.won && (
          <span className="ml-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">
            Winner
          </span>
        )}
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-800/60">
            <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">Player</th>
            <th className={`${thCls} text-zinc-500 w-9`}>LVL</th>
            <th className={`${thCls} text-emerald-600 w-8`}>K</th>
            <th className={`${thCls} text-red-600 w-8`}>D</th>
            <th className={`${thCls} text-zinc-500 w-8`}>A</th>
            <th className={`${thCls} text-zinc-500 w-14`}>LH/DN</th>
            <th className={`${thCls} text-amber-600 w-14`}>NET</th>
            <th className={`${thCls} text-zinc-500 w-16`}>GPM/XPM</th>
            <th className={`${thCls} text-zinc-500 w-14`}>HD</th>
            <th className={`${thCls} text-zinc-500 w-12`}>TD</th>
            <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">Items</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => <PlayerTableRow key={p.slot} player={p} />)}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-700 bg-zinc-800/30">
            <td className="px-2 py-1 text-[9px] text-zinc-600 font-medium">Totals</td>
            <td />
            <td className="text-center px-1 text-[10px] font-semibold text-emerald-500 tabular-nums">{totals.kills}</td>
            <td className="text-center px-1 text-[10px] font-semibold text-red-500 tabular-nums">{totals.deaths}</td>
            <td className="text-center px-1 text-[10px] text-zinc-400 tabular-nums">{totals.assists}</td>
            <td className="text-center px-1 text-[10px] text-zinc-500 tabular-nums whitespace-nowrap">{totals.lastHits}/{totals.denies}</td>
            <td className="text-center px-1 text-[10px] font-semibold text-amber-500 tabular-nums">{fmtK(totals.netWorth)}</td>
            <td />
            <td className="text-center px-1 text-[10px] text-zinc-500 tabular-nums">{fmtK(totals.heroDamage)}</td>
            <td className="text-center px-1 text-[10px] text-zinc-500 tabular-nums">{totals.towerDamage > 0 ? fmtK(totals.towerDamage) : "—"}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function SmallPlayerRow({ player, tab }) {
  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-800/60 transition-colors">
      {/* Compact player cell: small hero portrait + name */}
      <td className="px-2 py-1.5 max-w-27.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-9 h-6 shrink-0 rounded-sm overflow-hidden bg-zinc-800">
            {player.hero.img && (
              <img src={player.hero.img} alt={player.hero.name} className="w-full h-full object-cover object-top" />
            )}
          </div>
          <span className="text-[10px] font-medium text-zinc-200 truncate">
            {player.proName ?? player.personaname ?? player.hero.name ?? "—"}
          </span>
        </div>
      </td>

      {tab === "KDA" && (
        <>
          <td className="text-center px-1 w-8 text-[11px] font-semibold text-emerald-400 tabular-nums">{player.kills}</td>
          <td className="text-center px-1 w-8 text-[11px] font-semibold text-red-400 tabular-nums">{player.deaths}</td>
          <td className="text-center px-1 w-8 text-[11px] text-zinc-300 tabular-nums">{player.assists}</td>
          <td className="text-center px-1 w-16 text-[11px] font-semibold text-amber-400 tabular-nums">{fmtK(player.netWorth)}</td>
        </>
      )}

      {tab === "Farm" && (
        <>
          <td className="text-center px-1 w-14 text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">{player.lastHits}/{player.denies}</td>
          <td className="text-center px-1 w-16 text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">{player.gpm}/{player.xpm}</td>
          <td className="text-center px-1 w-16 text-[10px] font-semibold text-amber-400 tabular-nums">{fmtK(player.netWorth)}</td>
        </>
      )}

      {tab === "Damage" && (
        <>
          <td className="text-center px-1 w-16 text-[10px] text-zinc-400 tabular-nums">{fmtK(player.heroDamage)}</td>
          <td className="text-center px-1 w-14 text-[10px] text-zinc-500 tabular-nums">{player.towerDamage > 0 ? fmtK(player.towerDamage) : "—"}</td>
          <td className="text-center px-1 w-16 text-[10px] font-semibold text-amber-400 tabular-nums">{fmtK(player.netWorth)}</td>
        </>
      )}

      {tab === "Items" && (
        <td className="px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-0.5">
            {player.items.map((item, i) => <ItemSlot key={i} item={item} size="sm" />)}
            {player.neutral && (
              <>
                <div className="w-px h-3.5 bg-zinc-700 mx-0.5 shrink-0" />
                <ItemSlot item={player.neutral} size="sm" rounded />
              </>
            )}
          </div>
          {player.backpack?.some(Boolean) && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <GiBackpack className="w-3 h-3 text-zinc-500 shrink-0 mr-0.5" />
              {player.backpack.map((item, i) => <ItemSlot key={i} item={item} size="sm" />)}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

export function SmallTeamTable({ players, team, tab }) {
  const thCls = "px-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-center whitespace-nowrap";

  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-700 ${team.isRadiant ? "bg-emerald-950/60" : "bg-red-950/60"}`}>
        <LogoBox src={team.logo} size="sm" />
        <span className="text-sm font-bold text-white">{team.name}</span>
        {team.won && (
          <span className="ml-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">
            Winner
          </span>
        )}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-800/60">
            <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">Player</th>
            {tab === "KDA" && (
              <>
                <th className={`${thCls} text-emerald-600 w-8`}>K</th>
                <th className={`${thCls} text-red-600 w-8`}>D</th>
                <th className={`${thCls} text-zinc-500 w-8`}>A</th>
                <th className={`${thCls} text-amber-600 w-16`}>NET</th>
              </>
            )}
            {tab === "Farm" && (
              <>
                <th className={`${thCls} text-zinc-500 w-14`}>LH/DN</th>
                <th className={`${thCls} text-zinc-500 w-16`}>GPM/XPM</th>
                <th className={`${thCls} text-amber-600 w-16`}>NET</th>
              </>
            )}
            {tab === "Damage" && (
              <>
                <th className={`${thCls} text-zinc-500 w-16`}>HD</th>
                <th className={`${thCls} text-zinc-500 w-14`}>TD</th>
                <th className={`${thCls} text-amber-600 w-16`}>NET</th>
              </>
            )}
            {tab === "Items" && (
              <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">Items</th>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => <SmallPlayerRow key={p.slot} player={p} tab={tab} />)}
        </tbody>
      </table>
    </div>
  );
}

export function MatchDetailModal({ game, series, onClose }) {
  const { data, isLoading } = useSWR(
    `/api/widgets/dota2?mode=match&matchId=${game.id}`,
    { revalidateOnFocus: false },
  );

  const [activeTab, setActiveTab] = useState("KDA");

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { team1Id, team1Name, team1Logo, team2Name, team2Logo } = series;
  const t1Won      = game.winnerId === team1Id;
  const t1IsRadiant = game.team1IsRadiant ?? true;
  const duration   = game.length
    ? `${Math.floor(game.length / 60)}:${String(game.length % 60).padStart(2, "0")}`
    : null;

  const radiantPlayers = data?.radiantPlayers ?? [];
  const direPlayers    = data?.direPlayers    ?? [];

  const radiantTeam = t1IsRadiant
    ? { name: team1Name, logo: team1Logo,  won: t1Won,  isRadiant: true }
    : { name: team2Name, logo: team2Logo,  won: !t1Won, isRadiant: true };
  const direTeam = t1IsRadiant
    ? { name: team2Name, logo: team2Logo,  won: !t1Won, isRadiant: false }
    : { name: team1Name, logo: team1Logo,  won: t1Won,  isRadiant: false };

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-xl bg-zinc-900 shadow-2xl overflow-hidden mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header: team · score · team ── */}
        <div className="flex items-center gap-4 px-4 py-3 bg-zinc-800 border-b border-zinc-700 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LogoBox src={team1Logo} size="md" />
            <span className="text-sm font-bold text-zinc-100 truncate">{team1Name}</span>
            {t1Won && <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded shrink-0">Win</span>}
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className="text-xl font-bold tabular-nums text-zinc-100 leading-none">
              {game.team1Score ?? "—"} – {game.team2Score ?? "—"}
            </span>
            {duration && <span className="text-[10px] text-zinc-500 tabular-nums mt-0.5">{duration}</span>}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            {!t1Won && <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded shrink-0">Win</span>}
            <span className="text-sm font-bold text-zinc-100 truncate">{team2Name}</span>
            <LogoBox src={team2Logo} size="md" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 ml-2 text-zinc-500 hover:text-zinc-200 transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 10 }).map((_, i) => <PulseRow key={i} />)}
            </div>
          ) : (
            <>
              {/* Small screens: tab bar + compact tables */}
              <div className="block sm:hidden">
                <div className="flex border-b border-zinc-700 bg-zinc-800/60 sticky top-0 z-10">
                  {STAT_TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTab(t)}
                      className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        activeTab === t
                          ? "text-white border-b-2 border-white -mb-px"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <SmallTeamTable players={radiantPlayers} team={radiantTeam} tab={activeTab} />
                <div className="border-t-2 border-zinc-700" />
                <SmallTeamTable players={direPlayers} team={direTeam} tab={activeTab} />
              </div>

              {/* Large screens: full scrollable table */}
              <div className="hidden sm:block">
                <div className="min-w-175">
                  <TeamTable players={radiantPlayers} team={radiantTeam} />
                  <div className="border-t-2 border-zinc-700" />
                  <TeamTable players={direPlayers} team={direTeam} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
