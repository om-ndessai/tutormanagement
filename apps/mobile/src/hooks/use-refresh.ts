import { useState } from 'react';

/**
 * Pull-to-refresh state for a screen: `refreshing` while `run` is in flight, and an `onRefresh`
 * for `Screen` or a list. The spinner is the pull's own, so it shows only for a pull, never for a
 * background refetch.
 */
export function useRefresh(run: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.resolve()
      .then(run)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
