"use client";

import { useSearchParams } from "next/navigation";
import { PreviewForm, type TradeOption } from "./PreviewForm";

/** Standalone Concept Preview form; ?trade=<slug> or ?project=<slug> preselects the target. */
export function PreviewFormWithQuery({ options }: { options: TradeOption[] }) {
  const q = useSearchParams();
  const want = q.get("project") ? `project-${q.get("project")}` : q.get("trade");
  const initial = options.find((o) => o.slug === want);
  return <PreviewForm key={want ?? "none"} tradeOptions={options} initial={initial} />;
}
