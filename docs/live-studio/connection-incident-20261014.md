# TikTok connection incident — 2026-10-14

The user reported no comment or gift reactions. Production attempts at 10:41
and 10:42 UTC failed before any connection or event was logged. The previous
classifier returned only `TIKTOK_CONNECT_FAILED`.

The production bundle renames SDK error constructors (for example
`UserOfflineError` becomes `cd`), invalidating classification by constructor
name. Fixed SDK messages and signing reasons now preserve classification, and
bounded traversal retains nested HTTP errors. Logs include only allowlisted
route/reason labels, HTTP status and boolean flags; no provider payloads,
credentials, viewer names or comments.

Commit `1700cfdfca9ce27ab212f05ef399ab6250e50f29` deployed successfully as
`dpl_B7ZMqf7mxMJCVL3tQDtUFYeYS3tf`. Sixteen targeted tests, TypeScript and the
optimized build with workflow validation passed.

At 10:51:20 UTC a fresh production connection for `zsofikavilaga` returned
`TIKTOK_OFFLINE`, with the SDK's fixed offline message detected. The operator
UI showed the same result and zero received comments/gifts. This proves the
current connector result; it does not prove whether the user had already
stopped the broadcast, nor explain the earlier attempts conclusively.

No AI trial, gift purchase, or public broadcast was started. No connector is
left active by this investigation. Real comment/gift recovery remains
unverified until the broadcaster confirms the active account and live state.
Screenshot: `verification/live-tiktok-offline-20261014.jpg`.
