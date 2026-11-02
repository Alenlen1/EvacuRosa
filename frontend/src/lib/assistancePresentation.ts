export function assistanceConnection({
  online,
  confirmed,
  terminal,
  connection,
  unavailable,
}: {
  online: boolean;
  confirmed: boolean;
  terminal: boolean;
  connection: string;
  unavailable: boolean;
}) {
  if (!online) return { state: "offline", label: "Offline" } as const;
  if (unavailable)
    return { state: "waiting", label: "Status unavailable" } as const;
  if (confirmed && terminal)
    return { state: "connected", label: "Status confirmed" } as const;
  if (connection === "Status May Be Outdated")
    return { state: "waiting", label: "Status may be outdated" } as const;
  if (connection === "Connected" && confirmed)
    return { state: "connected", label: "Connected" } as const;
  return {
    state: "waiting",
    label: connection === "Connected" ? "Checking status" : "Reconnecting",
  } as const;
}

export function formatAssistanceTime(value: string, includeDate = true) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return (
    new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      ...(includeDate
        ? ({ month: "short", day: "numeric", year: "numeric" } as const)
        : {}),
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date) + " PHT"
  );
}
