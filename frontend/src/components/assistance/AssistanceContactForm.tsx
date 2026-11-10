import { Phone, ShieldCheck, UserRound } from "lucide-react";
import type { AssistanceContact } from "@/lib/assistanceContact";
import styles from "./AssistanceProvider.module.css";

export function AssistanceContactForm({
  firstVisit,
  name,
  contact,
  errors,
  onNameChange,
  onContactChange,
  onSave,
}: AssistanceContact & {
  firstVisit: boolean;
  errors: { name?: string; contact?: string };
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <form
      id="assistance-contact-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <p className={styles.intro}>
        {firstVisit
          ? "Save your name and contact number to fill in future assistance requests faster. Both are optional."
          : "Update the details used for your next assistance request."}
      </p>
      <div className={`${styles.contactGrid} ${styles.savedContactFields}`}>
        <label htmlFor="assistance-contact-name">
          <span>
            <UserRound size={16} aria-hidden="true" />
            Name <small>Optional</small>
          </span>
          <input
            id="assistance-contact-name"
            name="name"
            autoComplete="name"
            autoFocus
            value={name}
            maxLength={100}
            placeholder="Your name"
            onChange={(event) => onNameChange(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={
              errors.name ? "assistance-contact-name-error" : undefined
            }
          />
          {errors.name && (
            <p
              id="assistance-contact-name-error"
              className={styles.contactFieldError}
            >
              {errors.name}
            </p>
          )}
        </label>
        <label htmlFor="assistance-contact-phone">
          <span>
            <Phone size={16} aria-hidden="true" />
            Contact number <small>Optional</small>
          </span>
          <input
            id="assistance-contact-phone"
            name="tel"
            type="tel"
            inputMode="numeric"
            pattern="09[0-9]{9}"
            autoComplete="tel"
            value={contact}
            maxLength={11}
            placeholder="e.g. 09123456789"
            onChange={(event) => onContactChange(event.target.value)}
            aria-invalid={Boolean(errors.contact)}
            aria-describedby={
              errors.contact ? "assistance-contact-phone-error" : undefined
            }
          />
          {errors.contact && (
            <p
              id="assistance-contact-phone-error"
              className={styles.contactFieldError}
            >
              {errors.contact}
            </p>
          )}
        </label>
      </div>
      <p className={styles.contactPrivacy}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          Saved only in this browser on this device. Shared with CDRRMO only
          when you confirm a request. You can edit or clear these details in
          Emergency Assistance.
        </span>
      </p>
      {!firstVisit && (
        <p className={styles.smallNote}>
          Changes apply to future requests. Contact details on an already
          submitted request stay the same.
        </p>
      )}
    </form>
  );
}
