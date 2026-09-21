import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Says why a list is showing one row.
 *
 * A link from the comments feed narrows its destination page to the thing the
 * comment was about. Without a word of explanation that reads as a page which
 * has lost everything else, so the way back is always offered here -- and the
 * case where the row is not there to show is a sentence too, not an empty
 * list: the record may have been deleted since the comment was written.
 */
export function FocusNotice({
  active,
  found,
  what,
  onClear,
}: {
  active: boolean;
  found: boolean;
  what: string;
  onClear: () => void;
}) {
  if (!active) return null;

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-muted-foreground text-sm">
          {found
            ? `Showing one ${what}, linked from a comment.`
            : `That ${what} is no longer here — it may have been removed since the comment was written.`}
        </p>
        <Button variant="outline" size="sm" onClick={onClear}>
          Show all
        </Button>
      </CardContent>
    </Card>
  );
}
