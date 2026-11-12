import { useId } from 'react';

export function CompassMark({ className = 'h-10 w-10' }: { className?: string }) {
  const gradientId = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      role="img"
      aria-label="Компас"
    >
      <defs>
        <linearGradient id={`${gradientId}-bg`} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#17242d" />
          <stop offset="1" stopColor="#10151e" />
        </linearGradient>
        <linearGradient id={`${gradientId}-north`} x1="26" y1="11" x2="35" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a8fff0" />
          <stop offset="1" stopColor="#36d7b2" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill={`url(#${gradientId}-bg)`} stroke="#35505b" />
      <circle cx="24" cy="24" r="15" stroke="#577581" strokeOpacity=".55" />
      <path d="M24 6.5v3.2M24 38.3v3.2M6.5 24h3.2M38.3 24h3.2" stroke="#78a2a7" strokeLinecap="round" strokeOpacity=".8" />
      <path d="m32.8 13.5-6.1 13.1-13.1 6.1 6.1-13.1 13.1-6.1Z" fill="#0b1218" stroke="#4de0c0" strokeLinejoin="round" strokeWidth="1.2" />
      <path d="m32.8 13.5-6.1 13.1-1.1-8.3 7.2-4.8Z" fill={`url(#${gradientId}-north)`} />
      <path d="m26.7 26.6-13.1 6.1 4.8-7.2 8.3 1.1Z" fill="#f0b46a" />
      <circle cx="24" cy="24" r="2" fill="#f4f6f3" />
    </svg>
  );
}
