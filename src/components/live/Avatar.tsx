const PALETTE = [
  ["#e76f51", "#fff"],
  ["#2a9d8f", "#fff"],
  ["#8e6cf0", "#fff"],
  ["#e9c46a", "#1b1203"],
  ["#f4a261", "#1b1203"],
  ["#4d9de0", "#fff"],
  ["#e15a97", "#fff"],
  ["#7bc950", "#10240b"],
  ["#c77dff", "#fff"],
  ["#ef476f", "#fff"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarColors(name: string): [string, string] {
  return PALETTE[hash(name) % PALETTE.length] as [string, string];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name,
  size = 40,
  online,
  crown,
  dim,
  ring,
  bot,
  className = "",
}: {
  name: string;
  size?: number;
  online?: boolean;
  crown?: boolean;
  dim?: boolean;
  ring?: boolean;
  bot?: boolean;
  className?: string;
}) {
  const [bg, fg] = avatarColors(name);
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={name}
    >
      <span
        className={`flex h-full w-full items-center justify-center rounded-full font-bold ${ring ? "animate-glow" : ""}`}
        style={{
          background: bg,
          color: fg,
          fontSize: size * 0.38,
          opacity: dim ? 0.38 : 1,
          filter: dim ? "grayscale(0.7)" : undefined,
        }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {crown && (
        <span
          className="absolute left-1/2 -translate-x-1/2 drop-shadow"
          style={{ top: -size * 0.42, fontSize: size * 0.5 }}
          aria-label="Highest bidder"
        >
          👑
        </span>
      )}
      {bot && (
        <span
          className="absolute -top-1 -left-1 flex items-center justify-center rounded-full bg-[var(--arena)] leading-none"
          style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.28 }}
          aria-label="bot"
        >
          🤖
        </span>
      )}
      {online !== undefined && (
        <span
          className="absolute rounded-full border-2 border-[var(--arena)]"
          style={{
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            right: -1,
            bottom: -1,
            background: online ? "var(--win)" : "#4b5a4f",
          }}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </span>
  );
}
