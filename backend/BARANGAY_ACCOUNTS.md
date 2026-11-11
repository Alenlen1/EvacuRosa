# Barangay email/password accounts

For staff **Change email** and email-code **Forgot password**, follow
[ACCOUNT_EMAIL_SETUP.md](ACCOUNT_EMAIL_SETUP.md). Configure SMTP and apply the
recovery email template in Supabase before handing accounts over to staff.

One account per barangay opens its assigned dashboard directly. The system
operator provisions accounts; CDRRMO has no account-management responsibility.
This does not change public access, routing, hazards, or center permissions.

## 1. Fill the private email list

From the repository root:

```powershell
npm.cmd run accounts:barangays --workspace backend -- --template
```

This creates **`.runtime/barangay-accounts.json`**, already ignored by Git. Keep
the 18 barangay names unchanged and fill each `email` field. Use real addresses
controlled by the barangays for production and password recovery. Supabase does
not create Gmail mailboxes. Do not reuse one email for multiple barangays.

For a disposable local fixture, addresses on `example.test` can be used but
cannot receive recovery email. Do not distribute these as operational accounts.

## 2. Preview without changing Auth

The operator environment needs backend-only `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (or `backend/.env`). Never copy the service key into
either frontend. Then run:

```powershell
npm.cmd run accounts:barangays --workspace backend
```

This validates all 18 entries and prints barangay names/actions only. It checks
existing Auth identities and protected profile assignments before any mutation.
Email collisions, missing identities, duplicate assigned accounts, or a
SUPER_ADMIN/other-barangay assignment stop provisioning rather than reassigning
an unrelated account. The old private mapping table is inspected only to reuse
the correct existing Auth UUIDs.

## 3. Apply the reviewed account changes

```powershell
npm.cmd run accounts:barangays --workspace backend -- --apply
```

Existing code identities receive the new email and a strong random password;
their UUID and barangay assignment remain unchanged. Missing accounts are
created with assigned `BARANGAY_ADMIN` profiles. Auth emails are auto-confirmed
because this is a trusted operator provisioning operation, not public signup.
No invitation emails are requested. Supabase notification settings still apply.

The script saves credentials **before** Auth changes to an ignored
`.runtime/barangay-account-credentials-*.json` file and records `pending`,
`auth-saved`, or `ready` per account. Passwords/keys/tokens are never printed.
Distribute each credential individually. Do not commit, email as a group, place
in frontend code, or expose through a public URL. Delete private credential
exports after secure handoff.

Re-running skips completed identities without resetting their passwords. If a
run fails, inspect its private checkpoint. A newly created Auth identity whose
profile failed is recognized by server-controlled provisioning metadata on a
retry; its new password is saved in the new checkpoint before it is changed.
The latest successful checkpoint contains its usable password. No existing
operational account is deleted as a rollback.

No new SQL is needed when existing role/RLS migrations have been applied. Keep
all historical migrations and `barangay_access_accounts` during this transition.
Never use `migration repair` or remove migration files for this login change.

## 4. Test before retiring the entry account

- Deploy the backend and admin frontend together. The old code-login endpoint
  is gone. The shared unassigned account is rejected at staff sign-in.
- Sign in as each barangay: it opens `/admin/dashboard` with its own name, logo,
  centers, read-only map, occupancy and availability controls. No code prompt.
- Verify empty barangays show their own area with no other barangay's centers.
- Save occupancy/availability and check the summary, card, and marker agree.
- Test updating a different barangay's known test-center ID using the original
  token: the backend returns 404 and does not update the record. Test RLS directly
  using that user's token as well (never a service key). Restore any test values.
- Confirm CDRRMO still opens its superadmin dashboard and can manage records.
- Test sign-out, refresh and the old `/admin/barangays` bookmark redirect.

## 5. Disable the old shared login after these checks

```powershell
npm.cmd run accounts:barangays --workspace backend -- --retire-shared
```

This refuses until all 18 listed accounts are provisioned. It disables only
`brgyadmin@gmail.com` and removes its unassigned `BARANGAY_ADMIN` profile, so an
old token cannot use that profile. It refuses if that account has another role
or a barangay assignment. The Auth UUID is retained for audit references.

Existing six-character code passwords are replaced during migration, and the
backend no longer supports code exchange. Forgotten passwords for the new
accounts use the project's configured Supabase recovery process or a designated
operator reset. Changing the email list alone does not update Auth: preview and
apply are required.

## Change your own password

In the barangay workspace header, open **Account** (the person icon on mobile)
and choose **Change password**. Enter the current password, a new password of
at least 10 characters containing an uppercase letter (A–Z), a lowercase letter
(a–z), a number (0–9) and a special symbol, and its confirmation. Spaces do not
count as special symbols. Existing passwords can still be used to sign in.
The dialog verifies the current credentials with an
in-memory Auth client, checks the account matches the workspace session, and
updates that signed-in user through Supabase Auth. The temporary verification
session is signed out with local scope; the workspace session is preserved.
Project password-strength rules still apply. If Supabase requires recent
reauthentication, sign out and sign back in before retrying.

Passwords are not written to browser storage or the private credentials export.
Editing a password in a JSON export does not change Supabase Auth. After a
successful change, the exported initial password is outdated; use the new one.
No SQL migration or backend service-role endpoint is needed for this feature.

For server-side enforcement, set the same minimum length (10) and required
character types in the project's Supabase Auth password-security settings.
The form validation alone does not prevent someone calling the Auth API
directly. Project Auth settings are configured separately; this code change
does not modify the live project's settings.
