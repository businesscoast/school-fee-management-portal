import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number | undefined, props: P) {
  const { size: _s, ...rest } = props;
  return { width: size ?? 18, height: size ?? 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest };
}

export const IconDashboard = (p: P) => (
  <svg {...base(p.size, p)}>
    <rect x="3" y="3" width="8" height="10" rx="2.5" />
    <rect x="13" y="3" width="8" height="6" rx="2.5" />
    <rect x="13" y="11" width="8" height="10" rx="2.5" />
    <rect x="3" y="15" width="8" height="6" rx="2.5" />
  </svg>
);
export const IconStudents = (p: P) => (
  <svg {...base(p.size, p)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.5 19.5c.6-3.4 2.9-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
    <circle cx="17" cy="9.5" r="2.6" />
    <path d="M15.6 14.6c2.6.1 4.3 1.6 4.9 4.6" />
  </svg>
);
export const IconImport = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M12 4v11" />
    <path d="M8 11l4 4 4-4" />
    <path d="M4 17.5c0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3" />
  </svg>
);
export const IconAlerts = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
export const IconClasses = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M4 6.5l8-3.5 8 3.5-8 3.5z" />
    <path d="M7 8.8v5.2c0 1.5 2.3 3 5 3s5-1.5 5-3V8.8" />
    <path d="M20 6.5v6" />
  </svg>
);
export const IconCollections = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M4 18l5-6 4 3 7-8" />
    <path d="M15 7h5v5" />
  </svg>
);
export const IconReports = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p.size, p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p.size, p)} strokeWidth={2.2}>
    <circle cx="11" cy="11" r="7.1" stroke="#121212" />
    <path d="M16.3 16.3L21 21" stroke="#121212" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p.size, p)} strokeWidth={2.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M12 4v11M8 11l4 4 4-4" />
    <path d="M4 19h16" />
  </svg>
);
export const IconPrint = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M7 8V4h10v4" />
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M7 14h10v6H7z" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p.size, p)} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
export const IconWarning = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 10v4.5M12 17.5v.5" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p.size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.5" />
  </svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3.5 6a2 2 0 0 1 2-2z" />
  </svg>
);
export const IconMail = (p: P) => (
  <svg {...base(p.size, p)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
);
export const IconSparkle = (p: P) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5c.7 5 3.5 7.8 8.5 8.5-5 .7-7.8 3.5-8.5 8.5-.7-5-3.5-7.8-8.5-8.5 5-.7 7.8-3.5 8.5-8.5z" fill="currentColor" />
  </svg>
);
export const IconLogo = (p: P) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M9 22V11.5h8.2v2.3h-5.6v2.4h5v2.3h-5V22z" fill="#15201a" />
    <circle cx="22" cy="20" r="3" fill="#5f8b3e" />
  </svg>
);
export const IconWhatsApp = (p: P) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#25D366"
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
    />
  </svg>
);
export const IconRupee = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M6.5 4h11M6.5 9h11M6.5 14l8 6.5M6.5 14H10a5 5 0 0 0 0-10" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p.size, p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7.5" r="3.5" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16 4.1a3.5 3.5 0 0 1 0 6.8" />
  </svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M21 3L10.5 13.5" />
    <path d="M21 3l-6.5 18-4-7.5L3 9.5z" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...base(p.size, p)} strokeWidth={2}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconSheet = (p: P) => (
  <svg {...base(p.size, p)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M3.5 15h17M9.5 4v16" />
  </svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p.size, p)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.5-2h5L16 6h2.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
