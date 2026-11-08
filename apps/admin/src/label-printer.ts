const ALLOWED_LABEL_HOSTS = new Set([
  "garden-shop-label-printer-staging.pages.dev",
  "garden-shop-label-printer.pages.dev",
]);
export const STAGING_LABEL_PRINTER_URL =
  "https://garden-shop-label-printer-staging.pages.dev/";

export function labelPrinterUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !ALLOWED_LABEL_HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function injectLabelPrinterCard(html: string, destination: string | null): string {
  if (!destination || html.includes('data-label-printer="true"')) return html;
  const operations = /(<section\s+aria-labelledby="operations-title"[^>]*>[\s\S]*?<div class="modules">)([\s\S]*?)(<\/div>\s*<\/section>)/;
  const liveCard = `<a class="module" href="/labels-printing" data-label-printer="true"><strong>Labels &amp; Printing</strong><span>Upload Excel, generate shipping labels, print A4 sheets and monitor printing activity.</span></a>`;
  const liveHome = html.replace(
    operations,
    `$1${liveCard}$2$3`,
  );
  if (liveHome !== html) return liveHome;
  const legacyOperations = /(<h2 class="section-title">Daily operations<\/h2>\s*<section class="grid" aria-label="Daily operations">)([\s\S]*?)(<\/section>)/;
  const legacyCard = `<a class="card" href="/labels-printing" data-label-printer="true"><strong>Labels &amp; Printing</strong><span>Upload Excel, generate shipping labels, print A4 sheets and monitor printing activity.</span><em>Open labels →</em></a>`;
  return html.replace(legacyOperations, `$1${legacyCard}$2$3`);
}
