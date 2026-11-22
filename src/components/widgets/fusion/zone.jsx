import ZoneLogo from "./zone-logo";

// Shared chrome for widgets that draw their own card header (DOTA 2, PLEX, UPCOMING RELEASES, CLAUDE USAGE).
// Keeping the padding, header spacing, title size and logo size in one place keeps those cards identical.
export const ZONE_LOGO_SIZE = 16;

// Standard inner padding for a zone card (sits inside the card's own p-1).
export function ZoneBody({ children, className = "" }) {
  return <div className={`flex flex-col w-full px-3 py-3 ${className}`}>{children}</div>;
}

// Logo + accent title on the left, optional `right` meta on the right, `children` right after the title.
export function ZoneHeader({ icon, title, right, children, titleAttr }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3 min-h-4">
      <div className="flex items-center gap-2 min-w-0">
        <ZoneLogo icon={icon} size={ZONE_LOGO_SIZE} />
        <span
          className="widget-zone-label text-[10px] leading-none font-semibold uppercase tracking-widest truncate"
          style={{ color: "rgb(var(--accent))" }}
          title={titleAttr}
        >
          {title}
        </span>
        {children}
      </div>
      {right ? <span className="widget-zone-label text-[9px] leading-none opacity-70 shrink-0">{right}</span> : null}
    </div>
  );
}
