"use client";
import type { AssistanceContext } from "@/services/api";
import { useAssistance } from "@/components/assistance/AssistanceProvider";
import { useLanguage } from "@/components/LanguageProvider";
export function AssistancePrompt({ context }: { context: AssistanceContext }) {
  const { openRequest, hasRequest } = useAssistance();
  const { t } = useLanguage();
  return (
    <section className="assistance-prompt">
      <p>
        {t(
          "Hazards block the mapped route. You can request assistance from CDRRMO.",
        )}
      </p>
      <button
        type="button"
        className="primary-button"
        onClick={() => openRequest(context)}
      >
        {hasRequest ? t("View My Assistance Request") : t("Request Assistance")}
      </button>
      <p>
        {t(
          "Submission does not confirm acknowledgment or dispatch. Location is shared once.",
        )}
      </p>
    </section>
  );
}
