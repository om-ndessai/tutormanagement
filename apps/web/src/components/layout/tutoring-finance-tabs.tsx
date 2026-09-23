import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCapIcon, WalletIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type TutoringFinanceTab = 'tutoring' | 'finance';

/**
 * Which half of a Tutoring / Finance screen is showing, kept in `?tab=` so a
 * link to the finance view stays the finance view. Tutoring is the default:
 * a screen opened in front of a student must not lead with money.
 */
export function useTutoringFinanceTab(): [TutoringFinanceTab, (tab: TutoringFinanceTab) => void] {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'finance' ? 'finance' : 'tutoring';

  const setTab = (value: TutoringFinanceTab) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', value);
        return next;
      },
      { replace: true },
    );

  return [tab, setTab];
}

/**
 * A screen's two halves: how the teaching is going, and the money.
 *
 * The application really is two things, and one scrolling column made the
 * reader find that out for themselves. The dashboard splits on it (Phase 15),
 * and so does the sessions list (Phase 19), which a tutor keeps open during a
 * lesson to read the notes -- with the student looking at the same screen.
 */
export function TutoringFinanceTabs({
  tutoring,
  finance,
}: {
  tutoring: ReactNode;
  finance: ReactNode;
}) {
  const [tab, setTab] = useTutoringFinanceTab();

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as TutoringFinanceTab)}>
      <TabsList className="mb-4">
        <TabsTrigger value="tutoring">
          <GraduationCapIcon className="size-4" />
          Tutoring
        </TabsTrigger>
        <TabsTrigger value="finance">
          <WalletIcon className="size-4" />
          Finance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tutoring" className="space-y-4">
        {tutoring}
      </TabsContent>
      <TabsContent value="finance" className="space-y-4">
        {finance}
      </TabsContent>
    </Tabs>
  );
}
