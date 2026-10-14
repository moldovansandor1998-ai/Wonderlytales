# TikTok pause recovery — 2026-10-14

The installed connector 2.5.0 emits `streamEnd` and disconnects for both
`CONTROL_ACTION_STREAM_ENDED` (3) and `CONTROL_ACTION_STREAM_SUSPENDED` (4).
The previous server handler treated both as a terminal end, which invoked the
client's terminal callback and disabled automatic replies. A later screen-share
resume did not restart that queue.

The cloud bridge now distinguishes actual end from suspension. Ordinary pause
and unpause (actions 1 and 2) preserve the upstream connection. Suspension
requests reconnect without disabling automatic replies. During that recovery,
temporary offline, timeout and connection-busy responses may be retried, with
backoff and a bounded two-minute recovery window / six attempts. A cold offline
connection, actual end, signing/rate-limit errors and manual stop remain terminal.
This is connection recovery only; it never submits or retries AI/media generation.

The operator view and mobile controls show received comment/gift counts and
whether automatic replies are active. Counts survive automatic reconnects and
reset on a new manual connection; preview comments do not increment them.
Server logs record connection/pause/end and aggregate event counts, without
comment text, viewer identifiers or provider credentials.

Validation: 25 targeted tests cover native wire payloads, pause/unpause,
suspension/offline/reconnect, comment and gift forwarding after reconnect,
manual cancellation, actual stream end, lease cleanup and bounded retries.
Type checking passed. These are controlled tests, not a real TikTok broadcast.

The user's broadcast was offline during verification. Next live check: refresh
the studio, start the TikTok broadcast, then start the automatic show. Observe a
real comment increasing the comment counter and producing speech; observe a real
gift increasing the gift counter and producing its appropriate response. If
neither counter increases, inspect the bridge connection logs. If counters rise
without speech, inspect reply status and the response error log. Do not mark the
real broadcast verified from a manual AI preview or WebSocket probe alone.
