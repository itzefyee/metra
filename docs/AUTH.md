# Account-layer status

Metra's current account experience is a migration-stage implementation, not a
complete production identity system.

- Passwords are processed in Convex actions and stored with scrypt-derived
  hashes.
- Raw session tokens are returned only to the browser; Convex stores a SHA-256
  hash for lookup and expiry.
- Account database helpers are internal, and profile updates resolve identity
  from the session token server-side.
- The browser persists its raw token locally, so XSS-resistant, cookie-based
  session handling is still a required production upgrade.

Do not migrate legacy users, password hashes, or session records into Metra.
Require re-registration or run a separately reviewed authentication migration.
Before exposing private CAD files, account history, or uploads, replace this
layer with Convex Auth or another managed provider and enforce ownership in
every server-side function.
