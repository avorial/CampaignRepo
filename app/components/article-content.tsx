"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ArticleContent({ html, onClick }: { html: string; onClick?: (event: MouseEvent<HTMLDivElement>) => void }) {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const markup = useMemo(() => ({ __html: html }), [html]);
  const close = () => {
    setImage(null);
  };
  useEffect(() => {
    if (!image) {
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    closeButton.current?.focus();
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus(); }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [image]);

  function openImage(target: HTMLElement) {
    if (target.closest("[data-roll]")) return false;
    const photo = target.closest("img") || target.closest("a.image-fullsize-link, a.gallery-item")?.querySelector("img");
    if (!photo) return false;
    trigger.current = target.closest("a") || photo;
    setImage({ src: photo.getAttribute("src") || "", alt: photo.getAttribute("alt") || "Article image" });
    return true;
  }

  return <>
    <div className="content-body" onClick={(event) => {
      if (openImage(event.target as HTMLElement)) event.preventDefault();
      else onClick?.(event);
    }} onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === "Enter" || event.key === " ") && openImage(event.target as HTMLElement)) event.preventDefault();
    }} dangerouslySetInnerHTML={markup} />
    {image && createPortal(
      <div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label={image.alt} onClick={close}>
        <button ref={closeButton} type="button" className="lightbox-close" title="Close image" aria-label="Close image" onClick={close}><X size={24} /></button>
        <img className="lightbox-img" src={image.src} alt={image.alt} onClick={(event) => event.stopPropagation()} />
      </div>, document.body
    )}
  </>;
}
