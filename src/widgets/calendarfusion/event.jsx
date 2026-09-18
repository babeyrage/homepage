import classNames from "classnames";
import { DateTime } from "luxon";
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";

import { FUSION_MONO } from "components/widgets/fusion/primitives";

export default function Event({ event, colorVariants, showDate = false, showTime = false, showDateColumn = true }) {
  const [hover, setHover] = useState(false);
  const { i18n } = useTranslation();

  const children = (
    <>
      {showDateColumn && (
        <span className="ml-2 w-12 shrink-0 tabular-nums text-theme-400 dark:text-theme-500" style={{ fontFamily: FUSION_MONO }}>
          {(showDate || showTime) &&
            event.date
              .setLocale(i18n.language)
              .toLocaleString(showTime ? DateTime.TIME_24_SIMPLE : { month: "short", day: "numeric" })}
        </span>
      )}
      <span className="ml-2 h-1.5 w-1.5 shrink-0">
        <span className={classNames("block w-1.5 h-1.5 rounded-full", colorVariants[event.color] ?? "gray")} />
      </span>
      <div className="ml-2 h-5 text-left relative truncate flex-1 min-w-0">
        <div className="absolute mt-0.5 text-xs font-medium">{hover && event.additional ? event.additional : event.title}</div>
      </div>
      {event.isCompleted && (
        <span className="text-xs mr-1 ml-auto z-10 shrink-0">
          <IoMdCheckmarkCircleOutline />
        </span>
      )}
    </>
  );
  const className =
    "flex flex-row items-center text-xs relative h-5 w-full rounded-sm bg-theme-200/50 dark:bg-theme-900/20 mt-1";
  const key = `event-${event.title}-${event.date}-${event.additional}`;
  return event.url ? (
    <a
      className={classNames(className, "hover:bg-theme-300/50 dark:hover:bg-theme-800/20")}
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
