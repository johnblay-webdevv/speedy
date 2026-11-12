let seq = 0;

export function uid(prefix = "id") {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function compact(n) {
  const value = Math.abs(Number(n) || 0);
  const sign = n < 0 ? "-" : "";
  if (value < 1000) return sign + Math.round(value).toString();
  if (value < 1_000_000) {
    const digits = value < 10_000 ? 1 : value < 100_000 ? 1 : 0;
    return sign + trimNumber(value / 1000, digits) + "K";
  }
  return sign + trimNumber(value / 1_000_000, 1) + "M";
}

function trimNumber(value, digits) {
  return value.toFixed(digits).replace(/\.0$/, "");
}

export function money(n) {
  const value = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(value)) return "$0";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function moneyExact(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}

export function coinLabel(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

export function timeAgo(ts) {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function shortDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function countdown(end, now) {
  const total = Math.max(0, Math.floor((end - now) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function weekLabels() {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const labels = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(names[date.getDay()]);
  }
  return labels;
}
