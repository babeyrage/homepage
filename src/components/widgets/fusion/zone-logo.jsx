import ResolvedIcon from "components/resolvedicon";

// Logo shown at the start of a widget's own zone header (DOTA 2, PLEX, ...).
// Those widgets hide the generic icon+name row in custom.css and draw their own
// label, so the service's `icon` from services.yaml is rendered here instead.
// Falls back to the accent-coloured dot when no icon is configured.
export default function ZoneLogo({ icon, size = 16 }) {
  if (!icon) {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: "rgb(var(--accent))", boxShadow: "0 0 6px rgb(var(--accent) / 70%)" }}
      />
    );
  }
  return (
    <span className="shrink-0 flex items-center justify-center zone-logo" style={{ width: size, height: size }}>
      <ResolvedIcon icon={icon} width={size} height={size} alt="" />
    </span>
  );
}
