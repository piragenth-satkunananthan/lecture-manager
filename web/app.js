const state = {
  items: [],
  clarifications: [],
  failedSources: [],
  whatsappGroups: [],
  trackedGroup: null,
  groupCacheAt: null,
  extractionEnabled: false,
  month: new Date(),
  editingId: null,
};

const $ = (id) => document.getElementById(id);

const fieldLabels = {
  title: "Title",
  details: "Details",
  course: "Course",
  location: "Location",
  dueDate: "Due date",
  dueTime: "Due time",
  classDate: "Class date",
  classTime: "Class time",
  changeType: "Change type",
  changeDetails: "Change details",
};

const editableFields = new Set(Object.keys(fieldLabels));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = "") {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function setStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.className = isError ? "status error" : "status";
}

async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  if (response.status === 401) {
    showLogin();
    throw new Error("Please sign in.");
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

let pollTimer;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!$("planner-view").hidden) void refresh().catch(() => {});
  }, 15_000);
}

function showLogin() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  $("planner-view").hidden = true;
  $("login-view").hidden = false;
  $("password").focus();
}

function showPlanner() {
  $("login-view").hidden = true;
  $("planner-view").hidden = false;
  startPolling();
}

async function refresh() {
  const archived = $("show-archived").checked ? "?includeArchived=true" : "";
  const [health, items, clarifications, failedSources, groups, tracking] = await Promise.all([
    api("/api/health"),
    api(`/api/items${archived}`),
    api("/api/clarifications"),
    api("/api/sources/failed"),
    api("/api/whatsapp/groups"),
    api("/api/whatsapp/tracking"),
  ]);
  state.items = items.items;
  state.clarifications = clarifications.clarifications;
  state.failedSources = failedSources.sources;
  state.whatsappGroups = groups.groups;
  state.groupCacheAt = groups.generatedAt;
  state.trackedGroup = tracking.tracked;
  state.extractionEnabled = health.extractionEnabled;
  $("health").textContent = health.extractionEnabled ? "Extraction enabled" : "Extraction disabled";
  renderCalendar();
  renderItems();
  renderClarifications();
  renderFailedSources();
  renderWhatsAppTracking();
}

function formatDateTime(date, time) {
  return time ? `${date} ${time}` : date;
}

function itemDateLabel(item) {
  if (item.kind === "assignment" && item.dueDate) {
    return `Due ${formatDateTime(item.dueDate, item.dueTime)}`;
  }
  if (item.kind === "class" && item.classDate) {
    return `Class ${formatDateTime(item.classDate, item.classTime)}`;
  }
  return "Date not set";
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $("month-label").textContent = state.month.toLocaleString(undefined, { month: "long", year: "numeric" });

  const grid = $("calendar");
  grid.replaceChildren();
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < leading; index++) {
    grid.append(el("div", "day empty"));
  }

  for (let day = 1; day <= days; day++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = el("div", "day");
    cell.append(el("span", "daynum", String(day)));
    const dayItems = state.items.filter((item) => item.dueDate === date || item.classDate === date);
    for (const item of dayItems) {
      const chip = el("button", "chip", item.title || item.kind);
      chip.type = "button";
      chip.addEventListener("click", () => focusItem(item.id));
      cell.append(chip);
    }
    grid.append(cell);
  }
}

function focusItem(id) {
  const node = document.querySelector(`[data-item-id="${id}"]`);
  if (!node) {
    setStatus("This item is archived; enable Show archived to see it.", true);
    return;
  }
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.add("flash");
  setTimeout(() => node.classList.remove("flash"), 1200);
}

function evidenceBlock(item) {
  const entries = Object.entries(item.fieldEvidence || {}).filter(([, quotes]) => Array.isArray(quotes) && quotes.length > 0);
  if (entries.length === 0) return null;
  const details = el("details", "evidence");
  details.append(el("summary", "", `Evidence (${entries.length} fields)`));
  const list = el("ul");
  for (const [field, quotes] of entries) {
    for (const quote of quotes) {
      list.append(el("li", "", `${field}: “${quote.quote}”`));
    }
  }
  details.append(list);
  return details;
}

function sourceBlock(item) {
  if (!item.source) return null;
  const source = item.source;
  return el(
    "div",
    "source",
    `Source · sender ${source.senderId} · group ${source.groupId} · message ${source.messageId} · ${new Date(source.sentAt).toLocaleString()}`,
  );
}

function renderItems() {
  const list = $("items");
  list.replaceChildren();
  const showArchived = $("show-archived").checked;
  const items = state.items.filter((item) => showArchived || item.status !== "archived");
  if (items.length === 0) {
    list.append(el("li", "empty", "No planner items yet."));
    return;
  }

  for (const item of items) {
    const row = el("li", "item");
    row.dataset.itemId = String(item.id);

    const head = el("div", "item-head");
    head.append(el("div", "item-title", item.title || "Untitled item"));
    const badges = el("div", "badges");
    badges.append(el("span", "badge", item.kind));
    badges.append(el("span", `badge ${item.status}`, item.status.replace("_", " ")));
    if (item.recordingPermission) badges.append(el("span", "badge", `recording ${item.recordingPermission}`));
    head.append(badges);
    row.append(head);

    const meta = el("div", "meta");
    meta.append(el("span", "", itemDateLabel(item)));
    if (item.course) meta.append(el("span", "", item.course));
    if (item.location) meta.append(el("span", "", item.location));
    if (item.ambiguousFields?.length) meta.append(el("span", "", `Needs: ${item.ambiguousFields.join(", ")}`));
    row.append(meta);

    if (item.details) row.append(el("div", "details", item.details));
    if (item.changeDetails) row.append(el("div", "details", item.changeDetails));

    const evidence = evidenceBlock(item);
    if (evidence) row.append(evidence);
    const source = sourceBlock(item);
    if (source) row.append(source);

    const actions = el("div", "actions");
    actions.append(button("Edit", () => openEdit(item)));
    if (["pending", "confirmed", "overdue_review"].includes(item.status)) {
      actions.append(button("Cancel", () => patchItem(item.id, { status: "cancelled" }), "danger"));
    }
    if (item.status !== "archived") {
      actions.append(button("Archive", () => patchItem(item.id, { status: "archived" })));
    }
    if (item.kind === "class" && item.status === "confirmed") {
      actions.append(button("Allow recording", () => setPermission(item.id, "confirmed")));
      actions.append(button("Decline", () => setPermission(item.id, "declined"), "danger"));
    }
    row.append(actions);
    list.append(row);
  }
}

function fieldInput(field) {
  if (field === "changeType") {
    const select = el("select");
    select.name = field;
    for (const [value, label] of [["", "None"], ["cancelled", "Cancelled"], ["rescheduled", "Rescheduled"]]) {
      const option = el("option", "", label);
      option.value = value;
      select.append(option);
    }
    return select;
  }
  const input = el("input");
  input.name = field;
  input.type = field.endsWith("Date") ? "date" : field.endsWith("Time") ? "time" : "text";
  return input;
}

function renderClarifications() {
  const list = $("clarifications");
  list.replaceChildren();
  if (state.clarifications.length === 0) {
    list.append(el("li", "empty", "No open questions."));
    return;
  }

  for (const clarification of state.clarifications) {
    const target = state.items.find((item) => item.id === clarification.itemId);
    const row = el("li", "question");
    row.append(el("div", "item-title", target?.title || "Planner question"));
    row.append(el("div", "details", clarification.question));

    const form = el("form");
    const fields = el("div", "fields");
    const requested = (clarification.requestedFields || []).filter((field) => editableFields.has(field));
    for (const field of requested) {
      const label = el("label", "", fieldLabels[field] || field);
      label.append(fieldInput(field));
      fields.append(label);
    }
    if (fields.childElementCount > 0) form.append(fields);

    const answerLabel = el("label", "", "Answer or note");
    const answer = el("textarea");
    answer.name = "answer";
    answer.rows = 2;
    answer.placeholder = "Optional note for your records";
    answerLabel.append(answer);
    form.append(answerLabel);

    const submit = el("button", "primary", "Resolve question");
    submit.type = "submit";
    form.append(submit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const updates = {};
      for (const input of form.querySelectorAll("[name]")) {
        if (input.name === "answer") continue;
        const value = input.value.trim();
        if (value) updates[input.name] = value;
      }
      try {
        submit.disabled = true;
        await api(`/api/clarifications/${clarification.id}/answer`, {
          method: "POST",
          body: JSON.stringify({ answer: answer.value.trim() || "Answered in planner", updates }),
        });
        setStatus("Question resolved.");
        await refresh();
      } catch (error) {
        setStatus(error.message, true);
      } finally {
        submit.disabled = false;
      }
    });

    row.append(form);
    list.append(row);
  }
}

function renderWhatsAppTracking() {
  const select = $("group-select");
  select.replaceChildren();
  if (state.whatsappGroups.length === 0) {
    const option = el("option", "", "No cached groups");
    option.value = "";
    select.append(option);
  } else {
    const placeholder = el("option", "", "Select a test group");
    placeholder.value = "";
    select.append(placeholder);
    for (const group of state.whatsappGroups) {
      const option = el("option", "", `${group.subject} (${group.size} members)`);
      option.value = group.id;
      select.append(option);
    }
  }
  if (state.trackedGroup) {
    const exists = state.whatsappGroups.some((group) => group.id === state.trackedGroup.groupId);
    if (!exists) {
      const option = el("option", "", `${state.trackedGroup.subject} (current)`);
      option.value = state.trackedGroup.groupId;
      select.append(option);
    }
    select.value = state.trackedGroup.groupId;
  }

  const parts = [];
  parts.push(state.groupCacheAt
    ? `List updated ${new Date(state.groupCacheAt).toLocaleString()}`
    : "No cached group list");
  parts.push(state.trackedGroup ? `Tracking: ${state.trackedGroup.subject}` : "No group selected");
  $("whatsapp-status").textContent = parts.join(" · ");
  $("allow-all-senders").checked = state.trackedGroup?.allowAllSenders ?? false;
  $("save-group").disabled = state.whatsappGroups.length === 0;
  $("clear-group").disabled = !state.trackedGroup;
}

async function saveTrackedGroup() {
  const groupId = $("group-select").value;
  if (!groupId) {
    setStatus("Select a group first.", true);
    return;
  }
  try {
    await api("/api/whatsapp/tracking", {
      method: "PUT",
      body: JSON.stringify({ groupId, allowAllSenders: $("allow-all-senders").checked }),
    });
    setStatus("Tracked group saved.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function clearTrackedGroup() {
  try {
    await api("/api/whatsapp/tracking", { method: "DELETE" });
    setStatus("Tracked group cleared.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function sourcePath(source, suffix = "") {
  return `/api/sources/${encodeURIComponent(source.groupId)}/${encodeURIComponent(source.messageId)}${suffix}`;
}

function renderFailedSources() {
  const list = $("failed-sources");
  list.replaceChildren();
  $("failed-note").textContent = state.extractionEnabled
    ? "Retained up to 30 days."
    : "Retry becomes available when extraction is enabled.";
  if (state.failedSources.length === 0) {
    list.append(el("li", "empty", "No failed posts."));
    return;
  }

  for (const source of state.failedSources) {
    const row = el("li", "item");
    row.append(el("div", "item-title", "Failed source message"));
    const meta = el("div", "meta");
    meta.append(el("span", "", `sender ${source.senderId}`));
    meta.append(el("span", "", new Date(source.sentAt).toLocaleString()));
    meta.append(el("span", "", source.failureCode || "unknown failure"));
    meta.append(el("span", "", `attempts ${source.attemptCount}`));
    if (source.rawTextExpiresAt) meta.append(el("span", "", `text expires ${new Date(source.rawTextExpiresAt).toLocaleString()}`));
    row.append(meta);

    const actions = el("div", "actions");
    const retry = button("Retry", () => { void retrySource(source); });
    retry.disabled = !state.extractionEnabled;
    actions.append(retry);
    actions.append(button("Delete", () => { void deleteSource(source); }, "danger"));
    row.append(actions);
    list.append(row);
  }
}

async function retrySource(source) {
  try {
    await api(sourcePath(source, "/retry"), { method: "POST" });
    setStatus("Retry processed.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function deleteSource(source) {
  if (!window.confirm("Delete this failed post and its retained text?")) return;
  try {
    await api(sourcePath(source), { method: "DELETE" });
    setStatus("Failed post deleted.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function patchItem(id, payload) {
  try {
    await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setStatus("Item updated.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function setPermission(id, decision) {
  try {
    await api(`/api/items/${id}/recording-permission`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
    setStatus(`Recording permission ${decision}.`);
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function openEdit(item) {
  state.editingId = item.id;
  const form = $("edit-form");
  for (const field of editableFields) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    const value = item[field];
    input.value = value ?? "";
  }
  $("edit-dialog").showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  if (!state.editingId) return;
  const form = $("edit-form");
  const corrections = {};
  for (const field of editableFields) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    const value = input.value.trim();
    corrections[field] = value === "" ? null : value;
  }
  try {
    await api(`/api/items/${state.editingId}`, {
      method: "PATCH",
      body: JSON.stringify({ corrections }),
    });
    $("edit-dialog").close();
    setStatus("Item saved.");
    await refresh();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function login(event) {
  event.preventDefault();
  $("login-error").textContent = "";
  const submit = $("login-form").querySelector("button");
  submit.disabled = true;
  try {
    await api("/api/session", {
      method: "POST",
      body: JSON.stringify({ password: $("password").value }),
    });
    $("password").value = "";
    showPlanner();
    await refresh();
  } catch (error) {
    $("login-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function logout() {
  try {
    await api("/api/session", { method: "DELETE" });
  } catch {
    // The local view still returns to the login screen.
  }
  showLogin();
}

function changeMonth(delta) {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
  renderCalendar();
}

function bind() {
  $("login-form").addEventListener("submit", login);
  $("logout").addEventListener("click", logout);
  $("prev-month").addEventListener("click", () => changeMonth(-1));
  $("next-month").addEventListener("click", () => changeMonth(1));
  $("show-archived").addEventListener("change", () => { void refresh().catch(() => {}); });
  $("refresh-groups").addEventListener("click", () => { void refresh().catch(() => {}); });
  $("save-group").addEventListener("click", () => { void saveTrackedGroup(); });
  $("clear-group").addEventListener("click", () => { void clearTrackedGroup(); });
  $("edit-cancel").addEventListener("click", () => $("edit-dialog").close());
  $("edit-form").addEventListener("submit", saveEdit);
  $("edit-dialog").addEventListener("close", () => { state.editingId = null; });
}

async function boot() {
  bind();
  try {
    await refresh();
    showPlanner();
  } catch {
    showLogin();
  }
}

void boot();
