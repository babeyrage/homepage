import { useState, useMemo } from "react";
import { useTranslation } from "next-i18next/pages";

import Container from "components/services/widget/container";
import { Led, MonoLabel, Chevron, FUSION_COLORS, FUSION_MONO } from "components/widgets/fusion/primitives";
import useWidgetAPI from "utils/proxy/use-widget-api";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const LIMIT_PRESETS = [5, 10, 20, 50];

const severityColorsActive = {
  CRITICAL: "bg-red-500/30 text-red-300 ring-red-500/40",
  HIGH: "bg-orange-500/30 text-orange-300 ring-orange-500/40",
  MEDIUM: "bg-yellow-500/30 text-yellow-300 ring-yellow-500/40",
  LOW: "bg-blue-500/30 text-blue-300 ring-blue-500/40",
  UNKNOWN: "bg-theme-500/30 text-theme-300 ring-theme-500/40",
};

const severityColorsInactive = {
  CRITICAL: "bg-red-500/5 text-red-400/40 ring-red-500/10",
  HIGH: "bg-orange-500/5 text-orange-400/40 ring-orange-500/10",
  MEDIUM: "bg-yellow-500/5 text-yellow-400/40 ring-yellow-500/10",
  LOW: "bg-blue-500/5 text-blue-400/40 ring-blue-500/10",
  UNKNOWN: "bg-theme-500/5 text-theme-400/40 ring-theme-500/10",
};

const severityBadgeColors = {
  CRITICAL: "bg-red-500/10 text-red-400 ring-red-500/20",
  HIGH: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20",
  LOW: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
};

const severityAccent = {
  CRITICAL: "border-l-2 border-red-500",
  HIGH: "border-l-2 border-orange-500",
  MEDIUM: "border-l-2 border-yellow-500",
  LOW: "border-l-2 border-blue-500",
  UNKNOWN: "border-l-2 border-theme-500",
};

function SeverityBadge({ severity }) {
  const colors = severityBadgeColors[severity] ?? "bg-theme-500/10 text-theme-400 ring-theme-500/20";
  return (
    <span
      className={`w-16 inline-flex justify-center items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colors}`}
      style={{ fontFamily: FUSION_MONO }}
    >
      {severity}
    </span>
  );
}

function SeverityToggle({ severity, active, onToggle }) {
  const colors = active
    ? (severityColorsActive[severity] ?? severityColorsActive.UNKNOWN)
    : (severityColorsInactive[severity] ?? severityColorsInactive.UNKNOWN);
  return (
    <button
      type="button"
      onClick={() => onToggle(severity)}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-all cursor-pointer ${colors}`}
      style={{ fontFamily: FUSION_MONO }}
    >
      {severity}
    </button>
  );
}

function PillSelector({ label, options, value, onChange, format }) {
  return (
    <div className="flex items-center gap-1.5">
      <MonoLabel className="w-8 shrink-0 text-theme-500 dark:text-theme-400">{label}</MonoLabel>
      <div className="flex rounded overflow-hidden ring-1 ring-inset ring-theme-500/20">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`text-xs px-2 py-0.5 transition-all cursor-pointer border-r border-theme-500/10 last:border-r-0 ${
              value === opt
                ? "bg-theme-500/25 text-theme-100 font-semibold"
                : "bg-theme-500/5 text-theme-400/60 hover:bg-theme-500/10 hover:text-theme-300"
            }`}
          >
            {format ? format(opt) : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// CVSS v3.x/v2 metric abbreviations -> human labels. Lets the expanded row
// show the vector string (e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
// as readable chips instead of forcing people to know the notation.
const CVSS_METRICS = {
  AV: { label: "Attack vector", N: "Network", A: "Adjacent", L: "Local", P: "Physical" },
  AC: { label: "Attack complexity", L: "Low", H: "High" },
  PR: { label: "Privileges required", N: "None", L: "Low", H: "High" },
  UI: { label: "User interaction", N: "None", R: "Required" },
  S: { label: "Scope", U: "Unchanged", C: "Changed" },
  C: { label: "Confidentiality", N: "None", L: "Low", H: "High" },
  I: { label: "Integrity", N: "None", L: "Low", H: "High" },
  A: { label: "Availability", N: "None", L: "Low", H: "High" },
  Au: { label: "Authentication", N: "None", S: "Single", M: "Multiple" },
};

function parseCvssVector(vectorString) {
  return vectorString
    .split("/")
    .map((segment) => segment.split(":"))
    .filter(([key, value]) => CVSS_METRICS[key]?.[value])
    .map(([key, value]) => ({ key, label: CVSS_METRICS[key].label, value: CVSS_METRICS[key][value] }));
}

// Collapsed row adds a CWE tag when one's available. Clicking anywhere
// outside the CVE-ID link expands the row to reveal the full description
// plus the CVSS vector (as labeled chips, not raw notation) and CWE —
// richer detail than the hover-only tooltip this used to be limited to
// (see nvd/widget.js for the mapping).
function CveItem({ cve, expanded, onToggle }) {
  const date = new Date(cve.published).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const accent = severityAccent[cve.severity] ?? severityAccent.UNKNOWN;
  return (
    <div className={`bg-theme-200/50 dark:bg-theme-900/20 rounded-sm mx-1 my-0.5 ${accent}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex items-center gap-2 pl-2 pr-2 py-1.5 text-xs cursor-pointer"
      >
        <span className="text-theme-400 dark:text-theme-500 shrink-0 w-12 tabular-nums" style={{ fontFamily: FUSION_MONO }}>
          {date}
        </span>
        <a
          href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-theme-700 dark:text-theme-200 flex-1 hover:underline truncate"
          style={{ fontFamily: FUSION_MONO }}
          onClick={(e) => e.stopPropagation()}
        >
          {cve.id}
        </a>
        {cve.cwe && (
          <span
            className="hidden sm:inline text-theme-400 dark:text-theme-500 tabular-nums truncate max-w-24"
            style={{ fontFamily: FUSION_MONO }}
          >
            {cve.cwe}
          </span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {cve.score !== null && (
            <span
              className="tabular-nums font-bold text-theme-600 dark:text-theme-300 w-7 text-right"
              style={{ fontFamily: FUSION_MONO }}
            >
              {cve.score.toFixed(1)}
            </span>
          )}
          <SeverityBadge severity={cve.severity} />
          <Chevron expanded={expanded} />
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 pl-14 -mt-0.5 text-xs space-y-1.5">
          <p className="leading-relaxed text-theme-600 dark:text-theme-300">{cve.description}</p>
          {(cve.cwe || cve.vectorString) && (
            <div className="flex flex-wrap gap-1" title={cve.vectorString || undefined}>
              {cve.cwe && (
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-theme-500/10 text-theme-500 dark:text-theme-400 ring-theme-500/20"
                  style={{ fontFamily: FUSION_MONO }}
                >
                  {cve.cwe}
                </span>
              )}
              {cve.vectorString &&
                parseCvssVector(cve.vectorString).map(({ key, label, value }) => (
                  <span
                    key={key}
                    title={label}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset bg-theme-500/10 text-theme-500 dark:text-theme-400 ring-theme-500/20"
                    style={{ fontFamily: FUSION_MONO }}
                  >
                    {key}: {value}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [activeSeverities, setActiveSeverities] = useState(new Set(["CRITICAL", "HIGH"]));
  const [limit, setLimit] = useState(widget.limit ?? 10);
  const [expandedId, setExpandedId] = useState(null);
  const days = widget.days ?? 1;

  const toggleSeverity = (severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        if (next.size > 1) next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const toNvdDate = (date) => date.toISOString().replace(/\.\d{3}Z$/, ".000");
  const now = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  }, []);

  const pubEndDate = toNvdDate(now);
  const startDate = new Date(now);
  if (days <= 1) {
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setTime(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  const pubStartDate = toNvdDate(startDate);

  // NVD throttles unauthenticated requests hard as resultsPerPage grows (2000 can hang
  // 20s+ and never resolve). Only request the full page size when an apiKey is configured.
  const params = { resultsPerPage: widget.apiKey ? 2000 : 100, pubStartDate, pubEndDate, refreshInterval: 3600000 };
  if (widget.apiKey) params.apiKey = widget.apiKey;

  const { data, error } = useWidgetAPI(widget, "cves", params);
  const { data: totalData } = useWidgetAPI(widget, "total", { resultsPerPage: 1, refreshInterval: 3600000 });

  if (error) return <Container service={service} error={error} />;

  if (!data) {
    return (
      <Container service={service}>
        <div className="flex flex-col gap-1.5 w-full px-2 py-1.5 animate-pulse">
          <div className="h-4 w-12 rounded-sm bg-theme-300/40 dark:bg-theme-800/40" />
          <div className="h-2.5 w-32 rounded-sm bg-theme-300/30 dark:bg-theme-800/30" />
        </div>
      </Container>
    );
  }

  const totalResults = totalData?.totalResults;

  const vulnerabilities = (data.vulnerabilities ?? [])
    .filter((cve) => activeSeverities.has(cve.severity))
    .slice(0, limit);

  const ledColor = vulnerabilities.some((cve) => cve.severity === "CRITICAL")
    ? FUSION_COLORS.bad
    : vulnerabilities.some((cve) => cve.severity === "HIGH")
      ? FUSION_COLORS.warn
      : FUSION_COLORS.ok;

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex items-baseline gap-1.5 px-2 py-1.5">
          <Led color={ledColor} className="translate-y-[-2px]" />
          <span className="text-[15px] font-extrabold leading-tight tabular-nums" style={{ fontFamily: FUSION_MONO }}>
            {t("common.number", { value: totalResults })}
          </span>
          <MonoLabel className="text-theme-500 dark:text-theme-400/80">total cves</MonoLabel>
        </div>

        <div className="flex flex-wrap gap-1 px-2 py-1.5">
          {SEVERITIES.map((s) => (
            <SeverityToggle key={s} severity={s} active={activeSeverities.has(s)} onToggle={toggleSeverity} />
          ))}
        </div>

        <div className="flex flex-col w-full">
          {vulnerabilities.map((cve) => (
            <CveItem
              key={cve.id}
              cve={cve}
              expanded={expandedId === cve.id}
              onToggle={() => setExpandedId((current) => (current === cve.id ? null : cve.id))}
            />
          ))}
        </div>

        <div className="flex justify-end px-2 py-1.5">
          <PillSelector label="Show" options={LIMIT_PRESETS} value={limit} onChange={setLimit} />
        </div>
      </div>
    </Container>
  );
}
