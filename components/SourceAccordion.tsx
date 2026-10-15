"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import type { KBSource, Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface SourceAccordionProps {
  sources: KBSource[];
  lang: Lang;
  strings: UIStrings;
}

/** Source chips that expand the full KB chunk inline — one open at a time (FR6). */
export default function SourceAccordion({ sources, lang, strings }: SourceAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      <p
        lang={lang}
        className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {strings.sourcesHeading}
      </p>
      <ul className="space-y-2">
        {sources.map((source) => {
          const open = openId === source.id;
          return (
            <li key={source.id}>
              <button
                type="button"
                lang={lang}
                aria-expanded={open}
                aria-label={`${open ? strings.sourceCollapse : strings.sourceExpand}: ${source.title}`}
                onClick={() => setOpenId(open ? null : source.id)}
                className="flex w-full items-center gap-2 rounded-button border border-primary/25 bg-primary/5 px-3 py-2 text-left text-sm text-ink"
              >
                <Paperclip className="size-4 shrink-0 text-soil" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{source.title}</span>
                {open ? (
                  <ChevronUp className="size-4 shrink-0 text-muted" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
                )}
              </button>
              {open && (
                <p
                  lang={lang}
                  className="mt-1 max-h-64 overflow-y-auto rounded-button bg-cream p-3 text-sm whitespace-pre-wrap text-ink/90"
                >
                  {source.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
