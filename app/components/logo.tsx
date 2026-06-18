import Link from "next/link";

/**
 * CampaignRepo brand lockup — the golden pixel-dissolving die beside the
 * Fraunces "CampaignRepo" wordmark (Repo in gold).
 */
export default function Logo({ size = 34, href = "/" as string | null, wordmark = true }: { size?: number; href?: string | null; wordmark?: boolean }) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-mark" src="/brand/logo-dice.png" alt="CampaignRepo" width={size} height={size} />
      {wordmark && (
        <span className="brand-word" style={{ fontSize: Math.round(size * 0.62) }}>
          Campaign<b>Repo</b>
        </span>
      )}
    </>
  );
  if (href) return <Link className="brand-lockup" href={href}>{inner}</Link>;
  return <span className="brand-lockup">{inner}</span>;
}
