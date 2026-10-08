const ICON_PATHS = {
  home:     <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><rect x="10" y="14" width="4" height="6" /></>,
  users:    <><circle cx="8" cy="8" r="3" /><path d="M2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" /><circle cx="16.5" cy="9" r="2.3" /><path d="M14.5 14.2c2.4.5 4 2.5 4 5.8" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="0.6" /><rect x="8" y="6.5" width="2" height="2" /><rect x="14" y="6.5" width="2" height="2" /><rect x="8" y="11" width="2" height="2" /><rect x="14" y="11" width="2" height="2" /><rect x="10" y="15.5" width="4" height="5.5" /></>,
  filetext: <><rect x="5" y="3" width="14" height="18" rx="1.2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>,
  folder:   <path d="M3 6.7a1 1 0 0 1 1-1h4.8l1.8 2H20a1 1 0 0 1 1 1v10.6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  coin:     <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.3 9.3c0-1.3 1.2-2.1 2.7-2.1s2.7.9 2.7 2.1c0 2.7-5.4 1.6-5.4 4.4 0 1.3 1.2 2.1 2.7 2.1s2.7-.8 2.7-2.1" /></>,
  box:      <><path d="M3 8l9-4.5L21 8v9l-9 4.5L3 17z" /><path d="M3 8l9 4.5L21 8" /><line x1="12" y1="12.5" x2="12" y2="21" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="1.2" /><line x1="3.5" y1="9.5" x2="20.5" y2="9.5" /><line x1="8" y1="3" x2="8" y2="6.5" /><line x1="16" y1="3" x2="16" y2="6.5" /></>,
  edit:     <><path d="M4 20l1-4.2L15.3 5.5a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20z" /><line x1="13.8" y1="7" x2="17" y2="10.2" /></>,
  tag:      <><path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a1.5 1.5 0 0 0 .44 1.06l9 9a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-9-9a1.5 1.5 0 0 0-1.06-.44z" /><circle cx="8.3" cy="8.3" r="1.3" fill="currentColor" stroke="none" /></>,
  pin:      <><path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>,
  clock:    <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  list:     <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  user:     <><circle cx="12" cy="8.5" r="3.5" /><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" /></>,
  sparkle:  <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />,
  swap:     <><path d="M4 7h13l-3-3" /><path d="M20 17H7l3 3" /></>,
  alert:    <><path d="M12 4l9.5 16H2.5z" /><line x1="12" y1="10" x2="12" y2="14.3" /><circle cx="12" cy="17.1" r="0.6" fill="currentColor" stroke="none" /></>,
  bell:     <><path d="M12 3a5 5 0 0 0-5 5v3.2c0 .9-.35 1.8-.98 2.45L4.7 15c-.5.5-.14 1.4.56 1.4h13.5c.7 0 1.06-.9.56-1.4l-1.32-1.35A3.5 3.5 0 0 1 17 11.2V8a5 5 0 0 0-5-5z" /><path d="M9.5 19a2.5 2.5 0 0 0 5 0" /></>,
  van:      <><path d="M2.5 15V9.5a1 1 0 0 1 1-1h9v6.5" /><path d="M12.5 11h4.3l2.7 2.9v1.6h-2" /><line x1="2.5" y1="15" x2="20" y2="15" /><circle cx="7" cy="17.3" r="1.7" /><circle cx="16.3" cy="17.3" r="1.7" /></>,
  arrow:    <><line x1="4" y1="12" x2="19" y2="12" /><path d="M14 6.5l6 5.5-6 5.5" /></>,
};

export default function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}
