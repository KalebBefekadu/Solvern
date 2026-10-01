import { NextResponse } from "next/server";
import { callbackLeadSchema, flattenErrors, previewLeadSchema, type CallbackLead, type PreviewLead } from "@/lib/leads/schema";
import { BackendUnavailable, insertLead, signedViewUrl, uploadExists, type LeadRow, type PhotoRow } from "@/lib/server/backend";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { confirmCustomer, notifyTeam } from "@/lib/server/notify";
import { previewTarget } from "@/lib/content";

export const runtime = "nodejs";

const PREF_LABEL = { phone: "Phone call", text: "Text", email: "Email" } as const;

export async function POST(req: Request) {
  let json: Record<string, unknown>;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const isCallback = json?.type === "callback";
  const parsed = isCallback ? callbackLeadSchema.safeParse(json) : previewLeadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the highlighted fields.", fields: flattenErrors(parsed.error) }, { status: 422 });
  }
  const data = parsed.data;

  // Honeypot: pretend success so bots learn nothing.
  if (data.company) return NextResponse.json({ ok: true });

  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return NextResponse.json({ error: "We could not confirm you are a person. Please try again, or call us." }, { status: 400 });
  }

  try {
    let lead: LeadRow;
    let photos: PhotoRow[] = [];
    let tradeName: string | null = null;
    let fields: [string, string][];
    let firstName: string;

    if (data.type === "callback") {
      const d = data as CallbackLead;
      firstName = d.firstName;
      lead = {
        type: "callback",
        trade_slug: null,
        name: `${d.firstName} ${d.lastName}`,
        phone: d.phone,
        email: d.email,
        zip: d.zip,
        message: d.message,
        preferred_contact: d.preferredContact,
        existing_job: d.existingJob === "yes",
        job_number: d.existingJob === "yes" && d.jobNumber ? d.jobNumber : null,
        topic: d.topic,
        source_url: d.sourceUrl,
        utm: d.utm,
        status: "new",
      };
      fields = [
        ["Existing job", d.existingJob === "yes" ? `Yes${d.jobNumber ? `, ${d.jobNumber}` : ""}` : d.existingJob === "no" ? "No" : "Not sure"],
        ["Topic", d.topic],
        ["Name", lead.name],
        ["Phone", d.phone],
        ["Email", d.email],
        ["Zip", d.zip],
        ["Preferred contact", PREF_LABEL[d.preferredContact]],
        ["Message", d.message],
        ["Source", d.sourceUrl],
      ];
    } else {
      const d = data as PreviewLead;
      const trade = previewTarget(d.tradeSlug);
      if (!trade) return NextResponse.json({ error: "Choose a trade.", fields: { tradeSlug: "Choose a trade." } }, { status: 422 });
      tradeName = trade.name;
      firstName = d.name.split(/\s+/)[0];
      // Every referenced upload must exist.
      for (const p of d.photos) {
        const paths = [p.originalPath, p.annotatedPath].filter(Boolean) as string[];
        for (const path of paths) if (!(await uploadExists(path))) return NextResponse.json({ error: "A photo did not finish uploading. Please try again." }, { status: 400 });
      }
      lead = {
        type: d.type,
        trade_slug: trade.slug,
        name: d.name,
        phone: d.phone,
        email: d.email,
        zip: d.zip,
        message: d.message,
        preferred_contact: d.preferredContact ?? null,
        existing_job: false,
        job_number: null,
        topic: null,
        source_url: d.sourceUrl,
        utm: d.utm,
        status: "new",
      };
      photos = d.photos.map((p) => ({ original_path: p.originalPath, annotated_path: p.annotatedPath, strokes: p.strokes, notes: p.notes }));
      fields = [
        ["Trade", trade.name],
        [d.type === "visit" ? "What's happening" : "What they want", d.message],
        ["Name", d.name],
        ["Phone", d.phone],
        ["Email", d.email],
        ["Zip", d.zip],
        ["Photos", String(d.photos.length)],
        ["Source", d.sourceUrl],
      ];
      if (Object.keys(d.utm).length) fields.push(["UTM", Object.entries(d.utm).map(([k, v]) => `${k}=${v}`).join(", ")]);
    }

    const leadId = await insertLead(lead, photos);

    // Notifications never block the customer's confirmation.
    const photoLinks = await Promise.all(
      photos.map(async (p) => ({
        original: (await signedViewUrl(p.original_path)) ?? p.original_path,
        annotated: p.annotated_path ? ((await signedViewUrl(p.annotated_path)) ?? p.annotated_path) : null,
        notes: (p.notes as { n: number; text: string }[]).map((n) => `Note ${n.n}: ${n.text || "(no text)"}`),
      })),
    );
    await Promise.allSettled([
      notifyTeam({ leadId, type: lead.type, trade: tradeName, fields, photos: photoLinks, replyTo: lead.email }),
      confirmCustomer(lead.type, lead.email, firstName),
    ]);

    return NextResponse.json({ ok: true, id: leadId });
  } catch (e) {
    console.error("[leads]", e);
    const status = e instanceof BackendUnavailable ? 503 : 500;
    return NextResponse.json({ error: "Something went wrong on our side. Please call us and we will take it from here." }, { status });
  }
}
