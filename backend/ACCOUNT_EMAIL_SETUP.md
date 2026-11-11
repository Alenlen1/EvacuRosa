# Staff email changes and password recovery

Both CDRRMO and barangay staff use the same **Account → Change email / Change
password** menu. **Forgot password?** on the staff sign-in page provides an
email → verification code → new password flow. Email changes preserve the Auth
user UUID, profile role, barangay assignment and audit references.

## Required Supabase configuration before handover

1. Use actual inboxes controlled by each barangay and CDRRMO. Provisioning a
   Supabase identity does not create a Gmail mailbox. If the old address is
   inaccessible or belongs to someone else, the designated system operator
   must correct it through the supported Auth admin API after checking identity.
   Do not ask staff to confirm an address they do not control, edit Auth tables
   with SQL, or bypass verification of the new inbox.
2. In the Supabase project's **Authentication → Email / SMTP settings**, configure
   a custom SMTP provider and an authorized sender. Supabase's default sender is
   intended for testing and restricts delivery to project-team addresses. Keep
   SMTP credentials in the provider/Supabase settings, never NEXT_PUBLIC variables.
   Follow the [Brevo setup below](#brevo-smtp-setup) for this project's provider.
3. Under **Authentication → Email templates → Reset password**, paste the contents
   of [recovery-code.html](../supabase/templates/recovery-code.html). The template
   must contain `{{ .Token }}` so staff receive a code, not only a reset link.
   This repository file is a template for the operator to apply; deploying the
   app or running `supabase db push` does not update hosted email settings.
4. Set the project's email OTP length to **6 digits**. Use a short expiry, such
   as **10 minutes**, and enable appropriate Auth rate limits. The app's 60-second
   resend cooldown is a UI aid; server-side Auth limits enforce abuse protection.
   If CAPTCHA is enabled in the project, integrate its challenge with these
   forms before enabling email delivery; these forms do not bypass CAPTCHA.
5. For this app's **one-confirmation** flow, open **Authentication → Sign In /
   Providers → Email**, turn **Secure email change** **off**, and save. Keep
   **Confirm email** enabled. Supabase then asks for confirmation only in the
   **new inbox**; approval from the old inbox is not required. This setting is
   project-wide and applies to both staff roles. Under **Authentication → Emails
   → Change email address**, paste [change-email.html](../supabase/templates/change-email.html)
   and use the subject **Confirm your new email address**. Keep `{{ .NewEmail }}`
   and `{{ .ConfirmationURL }}` unchanged. Save the template and request a fresh
   confirmation to see the updated design; previously delivered emails do not change.
   Email/password-change security
   notifications can remain enabled; a notification is not another approval.
6. Set the Auth **Site URL** to the staff website, and allow the exact staff
   confirmation return URLs, e.g. `https://evacurosa-ops.vercel.app/admin/login`
   and `http://localhost:3001/admin/login` for local tests. Also allow
   `https://evacurosa-ops.vercel.app/admin/login?recovery=1` and
   `http://localhost:3001/admin/login?recovery=1` for password reset links.
   Avoid broad wildcards.
7. Match password rules in Supabase Auth: minimum **10 characters**, including
   uppercase, lowercase, number and symbol. Frontend validation alone cannot
   enforce policy for callers using Auth directly.

No new database table, SQL migration, service-role frontend key, or public signup
is needed. This feature does not give CDRRMO responsibility for managing barangay
accounts. The recovery recipient is the email already registered in Supabase
Auth, never a separately supplied destination for an existing account.

### A reset email contains a link instead of a code

The hosted **Reset password** template controls the message. If the email says
“Follow the link below to choose a new one,” the code template in step 3 has not
been applied yet. Save the supplied template in Supabase and request a fresh
email to use the code flow. Previously delivered emails cannot be edited.

The staff sign-in page also supports Supabase's default reset links. A valid
recovery link opens **Reset your password** directly at **New password** after
Auth verifies it. Recovery credentials stay in an isolated, nonpersistent client;
they do not replace a workspace session in another tab. After saving, sign in
with the new password. Expired, used or invalid links show a retry message;
opening a link alone never changes the password. Requesting a fresh email sets
the redirect to the staff origin that initiated recovery, with `?recovery=1` so
failed link callbacks also return to recovery instead of silently showing login.
Allow that exact URL as described above. With credentials removed from the URL,
refreshing or closing the reset form requires a fresh recovery email or code.

### Switching an existing project to one confirmation

Changing the app's wording does not change hosted Supabase Auth settings. Apply
step 5 above before testing a new email change. Deployment and `supabase db push`
do not change this setting. The app still verifies the current password before
requesting the change and checks Auth's current email before showing success.

Changing the setting does not resend a pending request's messages. The pending
screen waits **60 seconds** after sending. If the change remains unconfirmed,
it returns to **Change email**, clears the new-email and password fields, and
focuses the email input. Staff can enter an email and current password again
to request confirmation. Supabase's server-side rate limits still apply.

Reopening the dialog during those 60 seconds resumes the remaining wait using
Auth's recorded send time. Afterward it opens the editable form; returning to
the tab must not erase a new draft or put staff back on the waiting screen.
**Check confirmation**, reopening and the timeout's final status check do not
send mail or change the account. Success requires Auth to report the new
current email, including when confirmation completes just before the timeout.

The **60-second UI wait is not link expiry or cancellation**. The pending
confirmation link is still governed by Supabase; ignore it if abandoning that
change. Do not claim the request was cancelled or the email changed when only
the form was reset. An accepted send request is not proof of inbox delivery:
check **Supabase → Authentication → Logs** and **Brevo → Transactional → Email
logs** for sending failures, rate limits, delivery or bounce status.

## Brevo SMTP setup

Supabase generates and verifies the recovery code. Brevo delivers the email.
Configure delivery in the hosted Supabase dashboard; no Render/Vercel SMTP
variables, email-sending dependency, or SQL migration is needed. These instructions
do not configure either hosted account automatically.

### 1. Verify a sender in Brevo

1. Create a Brevo account controlled by the team and complete its onboarding.
   Confirm that transactional sending is enabled before testing delivery.
2. Open **Settings → Senders, Domains, IPs → Senders → Add a sender**.
3. Use **EvacuRosa** for the sender name and a real inbox the team controls for
   the sender email. Verify the code Brevo sends to that inbox.

This is one sender for the system. The recipients are each staff member's real
registered inbox; they do not need a Brevo account or to share the sender address.

For the current `vercel.app` setup, do not try to authenticate `vercel.app` or
`gmail.com`: their DNS records belong to their providers. Brevo documents temporary
sender-domain replacement with `brevosend.com` for unauthenticated/free-email
senders. This is a testing option, not a guarantee of activation or delivery.
If Brevo requires a domain for the account, complete that requirement using a
domain the team controls. For long-term use, authenticate that domain in Brevo.

### 2. Create the SMTP credentials

Open **Settings → SMTP & API → SMTP**, copy the **Login** shown there, and
generate a dedicated standard SMTP key named **EvacuRosa Supabase Auth**.
Store the key in the team's password manager and enter it directly in Supabase.
The SMTP key is different from a Brevo API key or the Gmail/Brevo account password.
The Login may be a generated `@smtp-brevo.com` address; copy the displayed value
rather than assuming it is the sender email. Never use that technical login as
the sender email.

### 3. Connect Supabase Auth

Open **Supabase → Authentication → Email / Emails → SMTP Settings**, enable
custom SMTP, and enter:

| Supabase field | Value |
| --- | --- |
| Sender email address | The exact sender verified in Brevo |
| Sender name | `EvacuRosa` |
| Host | `smtp-relay.brevo.com` |
| Port number | `465` (SSL/TLS) |
| Minimum interval per user | `60` seconds |
| Username | The **Login** displayed on Brevo's SMTP tab |
| Password | The dedicated Brevo **SMTP key** |

Save changes. Keep Supabase Auth rate limits enabled and within the Brevo plan's
quota. Do not paste SMTP credentials into this guide, chat, source code, or a
frontend environment file. SMTP is sent by Supabase, so an SMTP IP restriction
must allow the Supabase sender, not the Render backend's IP.

### 4. Apply the recovery-code template

In Supabase's **Email templates → Reset password**, use the subject
**EvacuRosa password recovery code** and paste
[recovery-code.html](../supabase/templates/recovery-code.html) as the body.
Preserve the literal `{{ .Token }}` placeholder. Configure six-digit email codes
and a short expiry (for example, 600 seconds). Keep the Change email template's
confirmation link; use the one-confirmation provider settings described above.

Supabase supplies the email content for this SMTP integration; creating a Brevo
marketing campaign or copying Supabase placeholders into a Brevo template is not
part of this setup. Disable link tracking for Auth messages so email-change
confirmation links are not rewritten.

### 5. Check one complete delivery

1. Use an existing controlled staff test account whose registered inbox you can
   open. On EvacuRosa staff sign-in, choose **Forgot password?** and request a code.
2. Check the inbox/spam folder and **Brevo → Transactional → Email logs**. Confirm
   the message contains a code, not the unrendered `{{ .Token }}` placeholder.
3. Enter the code, set a new password, and sign in. Confirm the same role and
   barangay assignment remain. Test both staff roles before handover.
4. If delivery fails, check Supabase Auth logs alongside Brevo's delivery status.
   Check sender verification, transactional-account activation, the SMTP Login
   and SMTP key, and quotas. Do not repeatedly resend while troubleshooting.

A generic acknowledgement in the app alone does not prove delivery. A recipient
must receive and successfully use the code before this setup is considered tested.
No live message has been sent merely by adding this guide.

Provider references: [Brevo Supabase integration](https://developers.brevo.com/docs/supabase-smtp-integration),
[sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[SMTP keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys),
[temporary sender-domain replacement](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

## Staff flow

- **Change email:** while signed in, enter a new email and current password.
  The password is verified in a temporary client without replacing the workspace
  session. With **Secure email change off** and **Confirm email on**, confirm
  the single link in the **new inbox**. Keep using the old sign-in address until
  Auth reports the change complete. The pending screen returns to a blank email
  form after 60 seconds without confirmation. Reopening during that period shows
  the remaining wait; it does not send another message. Return after confirmation
  or choose **Check confirmation**; the app verifies
  the current email with Auth and refreshes the same account's stored session
  when needed. It shows success only when Auth reports the new current email.
  Test a fresh sign-in with the new email and existing password; an already-open
  workspace session alone is not a test of which email can sign in.
- **Forgot password:** enter the account email, enter the latest six-digit
  recovery code, then choose and confirm a strong new password. Unknown accounts
  receive the same generic acknowledgement. Supabase validates expiry and single
  use. The recovery client lives only in memory, never in browser storage; it is
  cleared on close/success. Return to sign-in and use the new password. Closing
  or refreshing during recovery means starting again.
- If both the password and inbox access are lost, contact the designated system
  operator for identity-verified recovery. CDRRMO cannot reset another barangay's
  account from its dashboard.

## Verification with controlled test accounts

1. Check email change from both roles. Wrong passwords must not send a change;
   unchanged or malformed email is rejected. Confirm only the new inbox, then
   check the new address signs in to the same workspace and the old one does not.
   Also leave a request unconfirmed for 60 seconds: both input fields must clear,
   the current sign-in email must stay unchanged, and no email/account update
   may occur automatically. Reopen before/after the deadline and confirm that
   returning to the tab preserves a new draft. Check confirmation just before
   timeout is recognized instead of being presented as a failed change.
2. Request recovery for a test inbox. Check actual inbox/spam delivery and that
   the email contains a six-digit code. Merely opening the form must not send mail.
3. Verify a wrong, expired and already-used code is rejected. Test resend and
   cooldown; only the latest code should be used.
4. Check weak/mismatched passwords are rejected; complete a valid reset and sign
   in again. Confirm the old password fails and role/barangay permissions persist.
5. Confirm recovery does not open a dashboard or replace another tab's workspace
   session. Switch accounts during a pending email change: the operation must be
   rejected rather than applied to the new account.
6. Verify keyboard navigation, Escape/Cancel, visible loading/error feedback and
   layout on mobile. Do not use operational accounts for automated browser tests.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[recovery requests](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp),
[user updates](https://supabase.com/docs/reference/javascript/auth-updateuser),
[email-change confirmation settings](https://supabase.com/docs/reference/swift/auth-updateuser).
