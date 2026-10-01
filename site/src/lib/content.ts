import tradesData from "@/content/trades.json";
import approvedPages from "@/content/trade-pages.json";
import draftPages from "@/content/trade-pages-draft.json";
import seoData from "@/content/seo.json";
import projectsData from "@/content/projects.json";

export type Family =
  | "Groundwork"
  | "Structure & Shell"
  | "Interior Finishes"
  | "Home Systems"
  | "Outdoor Living"
  | "Specialty";

export type PrimaryAction = "concept-preview" | "diagnosis";

export interface Trade {
  slug: string;
  name: string;
  shortName: string;
  family: Family;
  color: string;
  onColor: string;
  tint: string;
  tintStrong: string;
  deep: string;
  tool: string;
  scope: string;
  primaryAction: PrimaryAction;
  status: "designed" | "needs-content";
  colorStatus: "approved" | "proposed";
  v1Color?: string;
}

export interface Item {
  title: string;
  description: string;
}
export interface Faq {
  q: string;
  a: string;
}

export interface TradePage {
  shortName: string;
  topic: string;
  heroHeadline: string;
  heroLead: string;
  heroPrimaryButton: string;
  heroProofLine: string;
  servicesTitle: string;
  servicesLead: string;
  services: Item[];
  photoSubject: string;
  formPlaceholder: string;
  teamPhotoShotList: string[];
  howItWorks: Item[];
  faq: Faq[];
  closingHeadline: string;
  seeItFirstTitle: string;
  seeItFirstLead: string;
  conceptMarkupExampleNotes: string[];
  primaryAction: PrimaryAction;
  copyStatus: "approved" | "draft-pending-owner-approval";
}

export const FAMILIES: Family[] = [
  "Groundwork",
  "Structure & Shell",
  "Interior Finishes",
  "Home Systems",
  "Outdoor Living",
  "Specialty",
];

export const FAMILY_BLURB: Record<Family, string> = {
  Groundwork: "What everything stands on.",
  "Structure & Shell": "The frame and the skin of the house.",
  "Interior Finishes": "The surfaces you see and touch every day.",
  "Home Systems": "Power, water, air and data.",
  "Outdoor Living": "The yard and its edges.",
  Specialty: "Custom and specialty installations.",
};

const HOW_VISUAL: Item[] = [
  { title: "Send a photo", description: "Draw on it to show what you want, in a few seconds." },
  { title: "See it first", description: "Your Concept Preview and estimate arrive within 48 hours." },
  { title: "Confirm on site", description: "We measure, confirm materials and give you a line-by-line estimate." },
  { title: "We build it", description: "On schedule, with updates at every stage and a final walkthrough." },
];

const HOW_DIAGNOSIS: Item[] = [
  { title: "Call or request a visit", description: "Tell us what is happening, or show us on a photo." },
  { title: "We diagnose on site", description: "We find the cause, not just the symptom." },
  { title: "Clear options", description: "Repair and replacement side by side, line by line." },
  { title: "We fix it right", description: "On schedule, tested and walked through with you." },
];

const SEE_LEAD_VISUAL =
  "Upload a photo, draw on it to show what you want, and get a concept image and estimate within 48 hours.";
const SEE_LEAD_DIAGNOSIS =
  "Draw on a photo to show us the problem. We diagnose it on site and give you clear options before any work begins.";
const SEE_TITLE_DIAGNOSIS = "Something not right? Show us where.";

export const trades: Trade[] = (tradesData.trades as unknown as Trade[]).map((t) => ({ ...t }));

/** Full trade name for navigation and directories: "Concrete, Foundation and Driveway". */
export function navName(t: Pick<Trade, "name">) {
  const parts = t.name.replace(/ & /g, " and ").split(" / ");
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export const tradeBySlug = (slug: string) => trades.find((t) => t.slug === slug);

export const tradesByFamily = () =>
  FAMILIES.map((family) => ({ family, trades: trades.filter((t) => t.family === family) }));

type RawPage = Record<string, unknown> & {
  concept_markup_example_notes?: string[];
  howItWorks?: Item[];
  seeItFirstTitle?: string;
  topic?: string;
  copyStatus?: string;
};

function topicFor(shortName: string) {
  return shortName === shortName.toUpperCase() ? shortName : shortName.toLowerCase();
}

function normalize(slug: string, raw: RawPage, approved: boolean): TradePage {
  const action = raw.primaryAction as PrimaryAction;
  const diagnosis = action === "diagnosis";
  const shortName = raw.shortName as string;
  return {
    ...(raw as unknown as TradePage),
    topic: (raw.topic as string) ?? topicFor(shortName),
    howItWorks: raw.howItWorks ?? (diagnosis ? HOW_DIAGNOSIS : HOW_VISUAL),
    seeItFirstTitle: diagnosis ? SEE_TITLE_DIAGNOSIS : (raw.seeItFirstTitle ?? "See your project before we build it."),
    seeItFirstLead: diagnosis ? SEE_LEAD_DIAGNOSIS : SEE_LEAD_VISUAL,
    conceptMarkupExampleNotes: raw.concept_markup_example_notes ?? [],
    copyStatus: approved ? "approved" : "draft-pending-owner-approval",
  };
}

const approved = approvedPages.pages as unknown as Record<string, RawPage>;
const drafts = draftPages.pages as unknown as Record<string, RawPage>;

export function tradePage(slug: string): TradePage | undefined {
  if (approved[slug]) return normalize(slug, approved[slug], true);
  if (drafts[slug]) return normalize(slug, drafts[slug], false);
  return undefined;
}

export interface Seo {
  title: string;
  description: string;
}
export const seo = seoData as unknown as { home: Seo; trades: Record<string, Seo> };

/** CSS custom properties that theme a page for one trade. */
export function tradeTheme(t: Pick<Trade, "color" | "onColor" | "tint" | "tintStrong" | "deep">) {
  return {
    "--trade": t.color,
    "--trade-on": t.onColor,
    "--trade-tint": t.tint,
    "--trade-tint-strong": t.tintStrong,
    "--trade-deep": t.deep,
    // Text on white buttons inside trade-colored bands: the trade color when it is dark enough, otherwise deep.
    "--trade-on-white": t.onColor.toUpperCase() === "#FFFFFF" ? t.color : t.deep,
  } as React.CSSProperties;
}

/** Hub theme: ink with the chalk-blue accent (brand kit, trade directory). */
export const HUB_THEME = tradeTheme({
  color: "#1B2330",
  onColor: "#FFFFFF",
  tint: "#EEF3FB",
  tintStrong: "#D6E1F4",
  deep: "#1D3F7A",
});


export interface Project {
  slug: string;
  name: string;
  formName: string;
  description: string;
  trades: string[];
  shot: string;
  formPlaceholder: string;
}
export const projects: Project[] = projectsData.projects;
export const PROJECT_PREFIX = "project-";
export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);

/** Resolves a Concept Preview target: a trade slug or `project-<slug>`. */
export function previewTarget(slug: string): { slug: string; name: string } | undefined {
  if (slug.startsWith(PROJECT_PREFIX)) {
    const p = projectBySlug(slug.slice(PROJECT_PREFIX.length));
    return p ? { slug, name: p.formName } : undefined;
  }
  const t = tradeBySlug(slug);
  return t ? { slug: t.slug, name: t.name } : undefined;
}
