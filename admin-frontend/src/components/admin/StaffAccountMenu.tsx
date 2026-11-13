"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  KeyRound,
  LoaderCircle,
  Mail,
  UserRound,
} from "lucide-react";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { ChangeEmailDialog } from "./ChangeEmailDialog";
import { SignOutButton } from "./SignOutButton";
import styles from "./StaffAccountMenu.module.css";

export function StaffAccountMenu({
  disabled = false,
  onSignOut,
  variant = "header",
}: {
  disabled?: boolean;
  onSignOut?: () => void | Promise<void>;
  variant?: "header" | "sidebar";
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const showAccountProgress = signingOut && variant === "header";

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        !signingOut &&
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!signingOut) {
          setOpen(false);
          trigger.current?.focus();
        }
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, signingOut]);

  async function signOut() {
    setSigningOut(true);
    try {
      await onSignOut?.();
    } catch (error) {
      setSigningOut(false);
      throw error;
    }
  }

  return (
    <>
      <div
        className={`${styles.account}${variant === "sidebar" ? ` ${styles.sidebar}` : ""}`}
        ref={container}
        onBlur={(event) => {
          if (
            !signingOut &&
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            setOpen(false);
        }}
      >
        <button
          type="button"
          className={styles.trigger}
          ref={trigger}
          disabled={disabled || signingOut}
          aria-expanded={open}
          aria-controls={id}
          aria-label={showAccountProgress ? "Signing out" : "Account"}
          aria-busy={showAccountProgress}
          onClick={() => setOpen((value) => !value)}
        >
          {showAccountProgress ? (
            <LoaderCircle
              className={styles.spinner}
              size={18}
              aria-hidden="true"
            />
          ) : (
            <UserRound size={18} aria-hidden="true" />
          )}
          <span>{showAccountProgress ? "Signing out…" : "Account"}</span>
          <ChevronDown
            className={styles.chevron}
            size={15}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div
            className={styles.panel}
            id={id}
            role="group"
            aria-label="Account actions"
          >
            <button
              type="button"
              className={styles.action}
              disabled={disabled || signingOut}
              onClick={() => {
                setOpen(false);
                setEmailOpen(true);
              }}
            >
              <Mail size={17} aria-hidden="true" />
              <span>Change email</span>
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={disabled || signingOut}
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
            >
              <KeyRound size={17} aria-hidden="true" />
              <span>Change password</span>
            </button>
            {variant === "header" && (
              <>
                <div className={styles.divider} />
                <SignOutButton
                  className={`${styles.action} ${styles.signOut}`}
                  disabled={disabled}
                  onSignOut={onSignOut ? signOut : undefined}
                />
              </>
            )}
          </div>
        )}
        {variant === "sidebar" && (
          <SignOutButton
            className={`${styles.action} ${styles.sidebarSignOut}`}
            disabled={disabled}
            onSignOut={onSignOut ? signOut : undefined}
          />
        )}
      </div>
      {passwordOpen && (
        <ChangePasswordDialog
          returnFocusRef={trigger}
          onClose={() => setPasswordOpen(false)}
        />
      )}
      {emailOpen && (
        <ChangeEmailDialog
          returnFocusRef={trigger}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </>
  );
}
