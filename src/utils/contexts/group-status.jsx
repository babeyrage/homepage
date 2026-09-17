import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Tracks which services within a services-group are currently reporting a
// widget fetch error, so the group heading can show a "N services · M
// errors" summary (see group.jsx) without every widget knowing about it.
const GroupStatusContext = createContext(null);

export function GroupStatusProvider({ children }) {
  const [erroredServices, setErroredServices] = useState(() => new Set());

  const reportError = useCallback((serviceName, hasError) => {
    if (!serviceName) return;
    setErroredServices((prev) => {
      const has = prev.has(serviceName);
      if (has === hasError) return prev;
      const next = new Set(prev);
      if (hasError) {
        next.add(serviceName);
      } else {
        next.delete(serviceName);
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ errorCount: erroredServices.size, reportError }), [erroredServices, reportError]);

  return <GroupStatusContext.Provider value={value}>{children}</GroupStatusContext.Provider>;
}

export function useGroupStatus() {
  return useContext(GroupStatusContext);
}
