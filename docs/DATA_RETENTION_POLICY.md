# VITAEON Data Retention Policy

Operational retention rules for production maintenance jobs.

## Authentication Tokens

`PasswordResetToken` and `EmailVerificationToken` records are purged by the existing `/api/cron/maintenance` job after 30 days when either:

- the token was already used, or
- the token expired more than 30 days ago.

This keeps short-lived authentication artifacts from accumulating indefinitely while preserving enough recent history for support and incident review.

## Audit Logs

`AuditLog` records are retained for operational traceability. The recommended retention target is 2 years, subject to legal and compliance review before any automated deletion is enabled.

Do not add automatic `AuditLog` purging until VITAEON has an approved legal retention policy and backup/export procedure.
