export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(value: string, locale: string = "en") {
  return new Intl.DateTimeFormat(locale === "mn" ? "mn-MN" : "en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
