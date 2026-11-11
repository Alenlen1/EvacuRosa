"use client";

import { useEffect, useState } from "react";
import type { AssistanceLocation } from "@/lib/assistanceLocation";
import { lookupSavedLocationName } from "@/lib/offline/routing";

export function useAssistanceLocationName(fix: AssistanceLocation | null) {
  const [resolved, setResolved] = useState<{
    key: string;
    name: string | null;
  } | null>(null);
  const latitude = fix?.latitude;
  const longitude = fix?.longitude;
  const key = fix ? `${latitude}:${longitude}:${fix.recordedAt}` : null;

  useEffect(() => {
    if (key === null || latitude === undefined || longitude === undefined)
      return;
    let active = true;
    void lookupSavedLocationName({ latitude, longitude }).then((name) => {
      if (active) setResolved({ key, name });
    });
    return () => {
      active = false;
    };
  }, [key, latitude, longitude]);

  return {
    name: resolved?.key === key ? resolved.name : null,
    loading: key !== null && resolved?.key !== key,
  };
}
