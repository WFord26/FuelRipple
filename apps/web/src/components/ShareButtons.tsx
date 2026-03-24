import { useState } from 'react';

interface ShareButtonsProps {
  /** Defaults to current window.location.href */
  url?: string;
  title: string;
  description?: string;
  /** Compact mode: icons only, no labels */
  compact?: boolean;
}

const SITE_URL = 'https://fuelripple.com';

export default function ShareButtons({ url, title, description, compact = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : SITE_URL);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&via=FuelRipple`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title, text: description ?? title, url: shareUrl });
    } catch {
      // user cancelled — silently ignore
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors';

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'flex-wrap'}`}>
      {!compact && (
        <span className="text-sm text-slate-400 font-medium mr-1">Share:</span>
      )}

      {/* X / Twitter */}
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.87L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        {!compact && <span>X</span>}
      </a>

      {/* Facebook */}
      <a
        href={facebookHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className={`${btnBase} bg-blue-700 hover:bg-blue-600 text-white`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        {!compact && <span>Facebook</span>}
      </a>

      {/* LinkedIn */}
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className={`${btnBase} bg-sky-700 hover:bg-sky-600 text-white`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        {!compact && <span>LinkedIn</span>}
      </a>

      {/* Native share (mobile) */}
      {hasNativeShare && (
        <button
          onClick={handleNativeShare}
          aria-label="Share"
          className={`${btnBase} bg-slate-700 hover:bg-slate-600 text-slate-200`}
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {!compact && <span>Share</span>}
        </button>
      )}

      {/* Copy link */}
      <button
        onClick={handleCopy}
        aria-label="Copy link"
        className={`${btnBase} ${
          copied
            ? 'bg-green-700 text-green-200'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
        }`}
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {!compact && <span>Copied!</span>}
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {!compact && <span>Copy Link</span>}
          </>
        )}
      </button>
    </div>
  );
}
