const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";
const LRM = "\u200E";
const RLM = "\u200F";
const LTR_RUN = /(https?:\/\/[^\s]+|[A-Za-z0-9@#$%_.,:+/-]+)/g;

function isolateLtrRuns(paragraph: string): string {
  return paragraph.replace(LTR_RUN, (run) => `${LRI}${run}${PDI}`);
}

export function formatWhatsAppText(text: string, locale: "en" | "ur"): string {
  const direction = locale === "ur" ? RLI : LRI;
  const paragraphDirection = locale === "ur" ? RLM : LRM;
  return text.split(/(\r\n|\n|\r)/).map((part) => {
    if (/^(\r\n|\n|\r)$/.test(part) || part === "") return part;
    const paragraph = locale === "ur" ? isolateLtrRuns(part) : part;
    return `${paragraphDirection}${direction}${paragraph}${PDI}`;
  }).join("");
}

export function formatNeutralLanguagePrompt(): string {
  return `${formatWhatsAppText("Choose your language", "en")} / ${formatWhatsAppText("اپنی زبان منتخب کریں", "ur")}`;
}
