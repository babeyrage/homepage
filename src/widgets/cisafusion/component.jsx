import { useState } from "react";
import { useTranslation } from "next-i18next/pages";

import Container from "components/services/widget/container";
import { Led, MonoLabel, Chip, FUSION_COLORS, FUSION_MONO } from "components/widgets/fusion/primitives";
import useWidgetAPI from "utils/proxy/use-widget-api";

const LIMIT_PRESETS = [5, 10, 20, 50];

function PillSelector({ label, options, value, onChange }) {
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
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function KevItem({ item }) {
  const date = new Date(item.dateAdded).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const due = new Date(item.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const overdue = new Date(item.dueDate) < new Date();

  return (
    <div
      className="bg-theme-200/50 dark:bg-theme-900/20 rounded-sm mx-1 my-0.5 pl-2 pr-2 py-1 flex items-center gap-2 text-xs border-l-2 border-red-500"
      title={item.description}
    >
      <span className="text-theme-400 dark:text-theme-500 shrink-0 w-12 tabular-nums" style={{ fontFamily: FUSION_MONO }}>
        {date}
      </span>
      <div className="flex-1 min-w-0">
        <a
          href={`https://nvd.nist.gov/vuln/detail/${item.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-theme-700 dark:text-theme-200 hover:underline"
          style={{ fontFamily: FUSION_MONO }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.id}
        </a>
        <div className="text-theme-500 dark:text-theme-400 truncate">
          {item.vendor} — {item.product}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {item.ransomware && <Chip color="#a855f7">Ransomware</Chip>}
        <span
          className="text-xs tabular-nums"
          style={{ fontFamily: FUSION_MONO, color: overdue ? FUSION_COLORS.bad : undefined }}
        >
          Due {due}
        </span>
      </div>
    </div>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  const [limit, setLimit] = useState(widget.limit ?? 10);

  const { data, error } = useWidgetAPI(widget, "kev", { refreshInterval: 3600000 });

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

  const items = (data.vulnerabilities ?? []).slice(0, limit);
  const ledColor = items.some((item) => item.ransomware) ? FUSION_COLORS.bad : FUSION_COLORS.ok;

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex items-baseline gap-1.5 px-2 py-1.5">
          <Led color={ledColor} className="translate-y-[-2px]" />
          <span className="text-[15px] font-extrabold leading-tight tabular-nums" style={{ fontFamily: FUSION_MONO }}>
            {t("common.number", { value: data.count })}
          </span>
          <MonoLabel className="text-theme-500 dark:text-theme-400/80">known exploited</MonoLabel>
        </div>

        <div className="flex flex-col w-full">
          {items.map((item) => (
            <KevItem key={item.id} item={item} />
          ))}
        </div>

        <div className="flex justify-end px-2 py-1">
          <PillSelector label="Show" options={LIMIT_PRESETS} value={limit} onChange={setLimit} />
        </div>
      </div>
    </Container>
  );
}
