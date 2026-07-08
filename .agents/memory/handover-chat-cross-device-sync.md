---
name: Handover Chat cross-device sync
description: Why an active Handover Chat conversation didn't appear on a second device, and the fix pattern
---

The conversational Handover Chat (`HandoverChatScreen` / `POST /api/handover/chat`) was
originally fully stateless/client-local: messages, extracted patients, and follow-up flags
lived only in React `useState` on the device where the screen was open. The "Link to Web"
QR feature only transfers auth credentials, not any in-memory UI state — so a session
started on a phone was invisible on a linked desktop browser and vice versa, even though
the user was logged into the same account on both.

**Why:** Any conversational/AI feature with multi-turn state that a user might reasonably
expect to "continue on another device" needs server-side persistence keyed by user, not
just client state — device-linking (auth transfer) is a separate concern from session sync.

**How to apply:** Added a `handover_sessions` Postgres table (one active row per user_id,
enforced via a partial unique index `WHERE status = 'active'`) upserted after every
`/api/handover/chat` turn, plus `GET`/`DELETE /api/handover/session` for the client to load
on mount and clear on "Start a new handover". Pattern is reusable for other stateful chat
features: persist server-side on every turn, keyed by user, and load on mount rather than
relying on client memory or device-linking alone.
