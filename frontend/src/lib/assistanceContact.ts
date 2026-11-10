export const ASSISTANCE_CONTACT_KEY = "evacurosa-assistance-contact-v1";

export interface AssistanceContact {
  name: string;
  contact: string;
}

export function validateAssistanceContact({
  name,
  contact,
}: AssistanceContact) {
  return {
    name: name.trim().length > 100 ? "Use 100 characters or fewer." : undefined,
    contact:
      contact.trim() && !/^09[0-9]{9}$/.test(contact.trim())
        ? "Enter an 11-digit mobile number starting with 09."
        : undefined,
  };
}

// Separate from request credentials so cancellation never removes saved details.
// A saved empty record also remembers that the first-visit prompt was skipped.
export function readAssistanceContact(): AssistanceContact | null {
  try {
    const raw = localStorage.getItem(ASSISTANCE_CONTACT_KEY);
    if (!raw || raw.length > 2000) return null;
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      typeof value.name !== "string" ||
      typeof value.contact !== "string"
    )
      return null;
    const errors = validateAssistanceContact(value);
    if (errors.name || errors.contact) return null;
    return { name: value.name.trim(), contact: value.contact.trim() };
  } catch {
    return null;
  }
}

export function writeAssistanceContact(value: AssistanceContact) {
  const errors = validateAssistanceContact(value);
  if (errors.name || errors.contact) throw Error(errors.name || errors.contact);
  const saved = { name: value.name.trim(), contact: value.contact.trim() };
  localStorage.setItem(
    ASSISTANCE_CONTACT_KEY,
    JSON.stringify({ version: 1, ...saved }),
  );
  return saved;
}
