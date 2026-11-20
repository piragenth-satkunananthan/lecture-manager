# Browser UI (`web`)

## Overview

Static browser client for Lecture Manager, served by the Fastify server at `/`.
It is a vanilla ES module (`app.js`) with no build step. The UI handles login,
the month calendar and item list, clarifications, failed-source retry/delete,
WhatsApp group tracking, recording permission, and an item-edit dialog. It
consumes the `/api/*` routes in `../src/server.ts` and is styled by
`style.css`.

## Interface

### Page contracts

- `index.html` loads `/style.css` and the ES module `/app.js` and defines the
  element IDs used by the script. Required login IDs: `login-view`,
  `login-form`, `password`, `login-error`. Required planner IDs:
  `planner-view`, `logout`, `health`, `prev-month`, `next-month`,
  `month-label`, `calendar`, `show-archived`, `items`. Required WhatsApp IDs:
  `refresh-groups`, `whatsapp-status`, `group-select`, `allow-all-senders`,
  `save-group`, `clear-group`. Required questions/failures IDs:
  `clarifications`, `failed-note`, `failed-sources`, `status`. Edit dialog
  IDs: `edit-dialog`, `edit-form`, `edit-cancel`
  `[index.html:id=planner-view]`, `[index.html:id=edit-dialog]`.
- The edit form uses named controls `title`, `course`, `location`, `dueDate`,
  `dueTime`, `classDate`, `classTime`, `changeType`, `details`, and
  `changeDetails` `[index.html:edit-form]`.
- Item rows expose `data-item-id`; `focusItem` looks them up by that attribute
  `[app.js:focusItem]`.

### API consumption

- `api(path, options)` is the only fetch wrapper. It defaults credentials to
  same-origin, adds `Content-Type: application/json` only when a body exists,
  returns `null` for HTTP 204, and throws the server `error` field on failure
  `[app.js:api]`.
- Polled reads: `GET /api/health`, `GET /api/items` (optionally
  `?includeArchived=true`), `GET /api/clarifications`,
  `GET /api/sources/failed`, `GET /api/whatsapp/groups`, and
  `GET /api/whatsapp/tracking` `[app.js:refresh]`.
- State changes: `POST/DELETE /api/session`,
  `PATCH /api/items/:id` (`status` or `corrections`),
  `POST /api/items/:id/recording-permission`,
  `POST /api/clarifications/:id/answer`,
  `POST /api/sources/:groupId/:messageId/retry`,
  `DELETE /api/sources/:groupId/:messageId`, and the tracking writes
  `PUT/DELETE /api/whatsapp/tracking`
  `[app.js:patchItem]`, `[app.js:saveTrackedGroup]`.

### Rendering and actions

- `refresh` refreshes the calendar, item list, clarifications, failed sources,
  WhatsApp tracking, and health text from one `Promise.all` of the six reads
  `[app.js:refresh]`.
- `renderCalendar`, `renderItems`, `renderClarifications`,
  `renderFailedSources`, and `renderWhatsAppTracking` own DOM construction.
- `openEdit`/`saveEdit` populate and submit the edit dialog; `fieldInput`
  chooses `select`, `date`, `time`, or text controls by field name
  `[app.js:fieldInput]`.
- Item display understands `kind` values `assignment` and `class`, and
  `status` values `pending`, `confirmed`, `overdue_review`, `cancelled`, and
  `archived` `[app.js:renderItems]`.
- Evidence is keyed by field name with arrays containing `quote` strings;
  source provenance exposes `senderId`, `groupId`, `messageId`, and `sentAt`
  `[app.js:evidenceBlock]`, `[app.js:sourceBlock]`.

### Styling

- `style.css` defines the two-column layout, calendar, badges, item chips,
  the edit dialog, and the `status`/`status error` classes used by
  `setStatus` `[style.css:.status.error]`.
- Status badges have specific styles for `confirmed`, `pending`,
  `overdue_review`, and `failed` `[style.css:.badge.confirmed]`.
- A single breakpoint at `max-width: 820px` collapses the layout to one
  column `[style.css:@media (max-width: 820px)]`.

## Invariants

- **Session expiry**: any HTTP 401 switches to the login view and throws
  `Please sign in.`; other failures surface the server error text
  `[app.js:api]`.
- **Polling**: polling is idempotent, runs every 15 seconds, refreshes only
  while the planner view is visible, and swallows background failures
  `[app.js:startPolling]`.
- **Read set**: every refresh issues all six GETs; only the items URL varies,
  and it appends the literal `?includeArchived=true` when the checkbox is
  checked `[app.js:refresh]`.
- **Archived filtering**: archived items are excluded from the list unless
  `show-archived` is checked; the calendar still matches items by exact
  `dueDate` or `classDate` `[app.js:renderItems]`.
- **Action visibility**: Cancel appears only for `pending`, `confirmed`, or
  `overdue_review`; Archive appears for every non-archived status; recording
  permission appears only for confirmed classes; Edit appears for every item
  `[app.js:renderItems]`.
- **Editable fields**: the edit surface is exactly `title`, `details`,
  `course`, `location`, `dueDate`, `dueTime`, `classDate`, `classTime`,
  `changeType`, and `changeDetails` `[app.js:fieldLabels]`.
- **Clarification fields**: inputs are restricted to
  `clarification.requestedFields` intersected with the editable set; blank
  answers become `Answered in planner`, and empty updates are omitted
  `[app.js:renderClarifications]`.
- **Safe DOM**: all dynamic text is assigned with `textContent`; `innerHTML`
  is not used `[app.js:el]`.
- **Retry gating**: Retry is disabled when `extractionEnabled` is false, and
  the failed-source note reflects that state `[app.js:renderFailedSources]`.
- **WhatsApp controls**: Save is disabled without cached groups, Clear is
  disabled without a tracked group, and a tracked group missing from the cache
  is appended as the current option `[app.js:renderWhatsAppTracking]`.
- **Delete confirmation**: deleting a failed source requires
  `window.confirm`; declining sends no request `[app.js:deleteSource]`.
- **Edit submission**: every editable field is sent as a trimmed string or
  `null` when blank; the dialog close event clears the editing ID
  `[app.js:saveEdit]`.
- **Status messaging**: `setStatus` sets exactly `status` or `status error`
  `[app.js:setStatus]`.

## Side Effects

- Six concurrent `GET` requests per refresh, plus one refresh after each
  successful mutation `[app.js:refresh]`.
- One 15-second `setInterval`, cleared on logout/session expiry
  `[app.js:startPolling]`, `[app.js:showLogin]`.
- DOM replacement of the calendar, item list, clarifications, failed sources,
  and group selector; visibility toggles on the login and planner views
  `[app.js:renderItems]`.
- Modal open/close via `showModal`/`close`, and focus moves to the password
  field on the login view `[app.js:openEdit]`, `[app.js:showLogin]`.
- `window.confirm` before deleting a failed source `[app.js:deleteSource]`.
- `scrollIntoView` plus a 1200 ms flash timeout when focusing an item
  `[app.js:focusItem]`.
- Event listeners for submit, click, and change events registered during
  `bind`, and `boot()` runs automatically at module evaluation
  `[app.js:bind]`, `[app.js:boot]`.

## Verification

- Run: `npm test` (backend build and Node test suite; there is no browser test
  runner in this repository).
