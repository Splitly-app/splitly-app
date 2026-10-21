const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

const dateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function formatBaht(cents: number) {
  return currency.format(cents / 100);
}

export function formatDate(value: string) {
  return dateTime.format(new Date(value));
}
