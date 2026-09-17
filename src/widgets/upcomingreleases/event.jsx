import classNames from "classnames";
import { DateTime } from "luxon";
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";

export default function Event({
  event,
  textColorVariants = {},
  showDate = false,
  showTime = false,
  showDateColumn = true,
}) {
  const [hover, setHover] = useState(false);
  const { i18n } = useTranslation();

  const children = (
    <>
      {showDateColumn && (
        <span className="w-14 shrink-0 pt-px text-[10px] text-theme-500 dark:text-theme-400">
          {(showDate || showTime) &&
            event.date
              .setLocale(i18n.language)
              .toLocaleString(showTime ? DateTime.TIME_24_SIMPLE : { month: "short", day: "numeric" })}
        </span>
      )}
      <div className="min-w-0 flex-1 truncate text-xs text-theme-700 dark:text-theme-200">
        {hover && event.additional ? event.additional : event.title}
      </div>
      {event.isCompleted && (
        <span className="shrink-0 text-theme-400 dark:text-theme-500">
          <IoMdCheckmarkCircleOutline />
        </span>
      )}
      {event.type && (
        <span
          className={classNames(
            "shrink-0 rounded-full border border-theme-500/10 bg-theme-200/50 px-1.5 py-0.5 text-[8.5px] font-medium dark:bg-theme-900/40",
            textColorVariants[event.color] ?? "text-theme-400 dark:text-theme-500",
          )}
        >
          {event.type}
        </span>
      )}
    </>
  );
  const className =
    "flex flex-row items-center gap-2 text-theme-700 dark:text-theme-200 border-b border-theme-500/10 last:border-b-0 py-1.5";
  const key = `event-${event.title}-${event.date}-${event.additional}`;
  return event.url ? (
    <a
      className={classNames(className, "transition-colors hover:bg-theme-200/30 dark:hover:bg-theme-900/20")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      key={key}
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ) : (
    <div className={className} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} key={key}>
      {children}
    </div>
  );
}
export const compareDateTimezone = (date, event) =>
  date.startOf("day").toISODate() === event.date.startOf("day").toISODate();
