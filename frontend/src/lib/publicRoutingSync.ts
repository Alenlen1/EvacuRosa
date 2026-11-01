/** Serial, generation-checked refreshes: a response begun before a change
 * notification must never overwrite the next snapshot. */
export function watchPublicRouting<T>({
  load,
  signature,
  publish,
  invalidate,
  failed,
  available,
  subscribe,
  intervalMs = 15000,
}: {
  load: () => Promise<{ data: T; fresh: boolean }>;
  signature: (data: T) => string;
  publish: (data: T, changed: boolean) => void;
  invalidate: () => void;
  failed: () => void;
  available: () => boolean;
  subscribe: (changed: () => void, reconnect: () => void) => () => void;
  intervalMs?: number;
}) {
  let stopped = false;
  let generation = 0;
  let busy = false;
  let queued = false;
  let invalid = false;
  let previous: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const markInvalid = () => {
    // Invalidate every notification, even during an earlier refresh: the user
    // may have started a new request since that earlier invalidation.
    invalidate();
    invalid = true;
  };
  const refresh = async () => {
    if (stopped) return;
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    const version = generation;
    try {
      const snapshot = await load();
      if (stopped || version !== generation) return;
      if (!snapshot.fresh && previous !== undefined) {
        failed();
        return;
      }
      const next = signature(snapshot.data);
      const changed = previous !== undefined && next !== previous;
      if (changed) markInvalid();
      // Cached data can be displayed initially, but never verify an invalid route.
      const recheck = snapshot.fresh && (invalid || changed);
      publish(snapshot.data, recheck);
      previous = next;
      if (snapshot.fresh) invalid = false;
      else if (invalid) failed();
    } catch {
      if (!stopped && version === generation) failed();
    } finally {
      busy = false;
      if (!stopped && queued) {
        queued = false;
        void refresh();
      }
    }
  };
  const changed = () => {
    if (stopped) return;
    generation++;
    markInvalid();
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 200);
  };
  const reconnect = () => {
    if (!stopped && available()) {
      // A reconnect may have missed changes while the tab was suspended.
      changed();
    }
  };
  const unsubscribe = subscribe(changed, reconnect);
  const poll = setInterval(() => {
    if (available()) void refresh();
  }, intervalMs);
  void refresh();
  return {
    reconnect,
    stop() {
      stopped = true;
      generation++;
      clearTimeout(timer);
      clearInterval(poll);
      unsubscribe();
    },
  };
}

export function publicRoutingSignature(groups: { id: string }[][]): string {
  return JSON.stringify(
    groups.map((rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id))),
  );
}
