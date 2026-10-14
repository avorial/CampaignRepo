"use client";

import { useMemo, type MouseEvent } from "react";

export default function ArticleContent({ html, onClick }: { html: string; onClick?: (event: MouseEvent<HTMLDivElement>) => void }) {
  const markup = useMemo(() => ({ __html: html }), [html]);
  return <div className="content-body" onClick={event => {
    const target = event.target as HTMLElement;
    // Native links retain keyboard, middle-click, and modifier-click behavior.
    if (!target.closest("[data-roll]") && target.closest("a")?.querySelector("img")) return;
    onClick?.(event);
  }} dangerouslySetInnerHTML={markup} />;
}
