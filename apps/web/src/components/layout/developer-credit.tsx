import { cn } from '@/lib/utils';

/**
 * Who built the portal, and the address to write to. One copy, shown at the
 * foot of the sidebar and on the sign-in page.
 *
 * Not part of the brand: it reads the same on the institute and the demo.
 */
export function DeveloperCredit({
  className,
  linkClassName = 'hover:text-primary',
}: {
  className?: string;
  /** How the name reacts to a pointer; on a coloured panel the primary colour would vanish. */
  linkClassName?: string;
}) {
  return (
    <p className={className}>
      Developed by:{' '}
      <a href="mailto:om.ndessai@gmail.com" className={cn('hover:underline', linkClassName)}>
        Om Dessai
      </a>
    </p>
  );
}
