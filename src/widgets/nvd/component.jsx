import { useState, useMemo } from "react";
import Container from "components/services/widget/container";
import Block from "components/services/widget/block";
import { useTranslation } from "next-i18next";

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
    <span className={`w-16 inline-flex justify-center items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colors}`}>
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
    >
      {severity}
    </button>
  );
}

function PillSelector({ label, options, value, onChange, format }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-theme-500 dark:text-theme-400 w-8 shrink-0">{label}</span>
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

function CveItem({ cve }) {
  const date = new Date(cve.published).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const accent = severityAccent[cve.severity] ?? severityAccent.UNKNOWN;
  return (
    <div
      className={`bg-theme-200/50 dark:bg-theme-900/20 rounded-sm mx-1 my-0.5 pl-2 pr-2 py-1 flex items-center gap-2 text-xs ${accent}`}
      title={cve.description}
    >
      <span className="text-theme-400 dark:text-theme-500 shrink-0 w-12 tabular-nums">{date}</span>
      <a
        href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono font-semibold text-theme-700 dark:text-theme-200 flex-1 hover:underline truncate"
        onClick={(e) => e.stopPropagation()}
      >
        {cve.id}
      </a>
      <div className="flex items-center gap-1.5 shrink-0">
        {cve.score !== null && (
          <span className="tabular-nums font-bold text-theme-600 dark:text-theme-300 w-7 text-right">
            {cve.score.toFixed(1)}
          </span>
        )}
        <SeverityBadge severity={cve.severity} />
      </div>
    </div>
  );
}


export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [activeSeverities, setActiveSeverities] = useState(new Set(["CRITICAL", "HIGH"]));
  const [limit, setLimit] = useState(widget.limit ?? 10);
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

  const params = { resultsPerPage: 2000, pubStartDate, pubEndDate, refreshInterval: 3600000 };
  if (widget.apiKey) params.apiKey = widget.apiKey;

  const { data, error } = useWidgetAPI(widget, "cves", params);
  const { data: totalData } = useWidgetAPI(widget, "total", { resultsPerPage: 1, refreshInterval: 3600000 });

  if (error) return <Container service={service} error={error} />;

  if (!data) {
    return (
      <Container service={service}>
        <Block value={t("nvd.loading")} />
      </Container>
    );
  }

  const totalResults = totalData?.totalResults;

  const vulnerabilities = (data.vulnerabilities ?? [])
    .filter((cve) => activeSeverities.has(cve.severity))
    .slice(0, limit);

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex flex-row w-full">
          <Block label="nvd.total" value={t("common.number", { value: totalResults })} />
        </div>

        <div className="flex flex-wrap gap-1 px-2 py-1">
          {SEVERITIES.map((s) => (
            <SeverityToggle key={s} severity={s} active={activeSeverities.has(s)} onToggle={toggleSeverity} />
          ))}
        </div>

        <div className="flex flex-col w-full">
          {vulnerabilities.map((cve) => (
            <CveItem key={cve.id} cve={cve} />
          ))}
        </div>

        <div className="flex justify-end px-2 py-1">
          <PillSelector label="Show" options={LIMIT_PRESETS} value={limit} onChange={setLimit} />
        </div>
      </div>
    </Container>
  );
}
