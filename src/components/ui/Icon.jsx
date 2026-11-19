import React from 'react';

const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  reports: <><path d="M7 3.75h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" /><path d="M14 4v4h4M9 12h6M9 16h6" /></>,
  users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7" r="3.5" /><path d="M16 4.2a3.5 3.5 0 0 1 0 6.6M17 15h.5a3.5 3.5 0 0 1 3.5 3.5V20" /></>,
  stores: <><path d="M4 10v10h16V10M3 4h18l-1.5 6H4.5L3 4Z" /><path d="M9 20v-6h6v6M4.5 10a2.5 2.5 0 0 0 5 0m0 0a2.5 2.5 0 0 0 5 0m0 0a2.5 2.5 0 0 0 5 0" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  login: <><path d="m14 17 5-5-5-5m5 5H7" /><path d="M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
  edit: <><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  back: <><path d="m14 18-6-6 6-6M8 12h12" /></>,
  next: <><path d="m10 18 6-6-6-6M16 12H4" /></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  pdf: <><path d="M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5M8.5 15h1.2a1.5 1.5 0 0 0 0-3H8.5v5m4-5v5h1a2.5 2.5 0 0 0 0-5h-1Zm5 5v-5h3" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.6 6.6-4.2m-6.6 7.2 6.6 4.2" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-4 4 3 3m-6-1 3 3" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
};

export default function Icon({ name, size = 16, className = '' }) {
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || null}
    </svg>
  );
}
