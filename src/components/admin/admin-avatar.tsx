import { ClayAvatar } from "@/components/ui/clay-avatar";

export function AdminAvatar({
  name,
  seed,
  src,
  size = 48,
}: {
  name: string;
  seed?: string | null;
  src: string | null;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" />
      ) : (
        <ClayAvatar seed={seed || name} className="size-full" />
      )}
    </span>
  );
}
