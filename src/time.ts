const SRI_LANKA_OFFSET_MINUTES = 330;

export function sriLankaDateTimeToUtc(date: string, time: string): string {
  const dateParts = date.split("-");
  const timeParts = time.split(":");
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  const hour = Number(timeParts[0]);
  const minute = Number(timeParts[1]);
  if (
    !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
    !Number.isInteger(hour) || !Number.isInteger(minute)
  ) {
    throw new Error(`Invalid Sri Lanka date/time: ${date} ${time}`);
  }
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - SRI_LANKA_OFFSET_MINUTES * 60_000,
  ).toISOString();
}

export function addCalendarDays(date: string, days: number): string {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function shiftIsoMinutes(iso: string, minutes: number): string {
  const value = new Date(iso);
  if (!Number.isFinite(value.valueOf())) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return new Date(value.valueOf() + minutes * 60_000).toISOString();
}
