import { DateTime } from "luxon";
import { useTranslation } from "next-i18next/pages";
import dynamic from "next/dynamic";
import { useContext, useEffect, useMemo, useState } from "react";

import Agenda from "./agenda";
import Monthly from "./monthly";

import Container from "components/services/widget/container";
import { SettingsContext } from "utils/contexts/settings";

const colorVariants = {
  // https://tailwindcss.com/docs/content-configuration#dynamic-class-names
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
  fuchsia: "bg-fuchsia-500",
  gray: "bg-gray-500",
  green: "bg-green-500",
  indigo: "bg-indigo-500",
  lime: "bg-lime-500",
  neutral: "bg-neutral-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
  stone: "bg-stone-500",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  white: "bg-white-500",
  yellow: "bg-yellow-500",
  zinc: "bg-zinc-500",
};

const textColorVariants = {
  // https://tailwindcss.com/docs/content-configuration#dynamic-class-names
  amber: "text-amber-500",
  blue: "text-blue-500",
  cyan: "text-cyan-500",
  emerald: "text-emerald-500",
  fuchsia: "text-fuchsia-500",
  gray: "text-gray-500",
  green: "text-green-500",
  indigo: "text-indigo-500",
  lime: "text-lime-500",
  neutral: "text-neutral-500",
  orange: "text-orange-500",
  pink: "text-pink-500",
  purple: "text-purple-500",
  red: "text-red-500",
  rose: "text-rose-500",
  sky: "text-sky-500",
  slate: "text-slate-500",
  stone: "text-stone-500",
  teal: "text-teal-500",
  violet: "text-violet-500",
  white: "text-white-500",
  yellow: "text-yellow-500",
  zinc: "text-zinc-500",
};

export default function Component({ service }) {
  const { widget } = service;
  const { i18n } = useTranslation();
  const [events, setEvents] = useState({});
  const nowDate = DateTime.now().setLocale(i18n.language);
  const currentDate = widget?.timezone ? nowDate.setZone(widget?.timezone).startOf("day") : nowDate;
  const [showDate, setShowDate] = useState(null);
  const { settings } = useContext(SettingsContext);

  useEffect(() => {
    // seeded after mount, not during render: "today" is client-only and would break hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!showDate) setShowDate(currentDate);
  }, [showDate, currentDate]);

  // params for API fetch
  const params = useMemo(() => {
    const constructedParams = {
      start: "",
      end: "",
      unmonitored: false,
    };

    if (showDate) {
      constructedParams.start = showDate.minus({ months: 3 }).toFormat("yyyy-MM-dd");
      constructedParams.end = showDate.plus({ months: 3 }).toFormat("yyyy-MM-dd");
    }

    return constructedParams;
  }, [showDate]);

  // Load active integrations
  const integrations = useMemo(
    () =>
      widget.integrations
        ?.filter((integration) => integration?.type)
        .map((integration) => ({
          // Include the extension so Vite/Vitest can statically validate the import base.
          service: dynamic(
            () =>
              import(
                /* webpackExclude: /\.test\.jsx$/ */
                `./integrations/${integration.type}.jsx`
              ),
          ),
          widget: { ...widget, ...integration },
        })) ?? [],
    [widget],
  );

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: "rgb(var(--accent))", boxShadow: "0 0 6px rgb(var(--accent) / 70%)" }}
            />
            <span
              className="widget-zone-label text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgb(var(--accent))" }}
            >
              Upcoming Releases
            </span>
          </div>
          <span className="widget-zone-label text-[9px] text-theme-500 dark:text-theme-400">
            next {widget?.maxEvents ?? 10}
          </span>
        </div>
        <div className="sticky top-0">
          {integrations.map((integration) => {
            const Integration = integration.service;
            const key = `integration-${integration.widget.type}-${integration.widget.service_name}-${integration.widget.service_group}-${integration.widget.name}`;

            return (
              <Integration
                key={key}
                config={integration.widget}
                params={params}
                setEvents={setEvents}
                hideErrors={settings.hideErrors}
                timezone={widget?.timezone}
                className="fixed bottom-0 left-0 bg-red-500 w-screen h-12"
              />
            );
          })}
        </div>
        {(!widget?.view || widget?.view === "monthly") && (
          <Monthly
            key={`monthly-${showDate?.toFormat("yyyy-MM-dd")}`}
            service={service}
            colorVariants={colorVariants}
            events={events}
            showDate={showDate}
            setShowDate={setShowDate}
            currentDate={currentDate}
            className="flex"
          />
        )}
        {widget?.view === "agenda" && (
          <Agenda
            key={`agenda-${showDate?.toFormat("yyyy-MM-dd")}`}
            service={service}
            textColorVariants={textColorVariants}
            events={events}
            showDate={showDate}
            setShowDate={setShowDate}
            className="flex"
          />
        )}
      </div>
    </Container>
  );
}
