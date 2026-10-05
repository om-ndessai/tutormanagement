import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/providers/auth-provider';

/**
 * The portal itself runs inside one organization. Without one chosen in this
 * tab, send the person to choose -- or, for a platform admin who belongs to
 * none, to the console. The API enforces the same rule on every request.
 */
export function RequireOrg() {
  const { organization, memberships, invitations, platformAdmin } = useAuth();
  const location = useLocation();

  if (organization) return <Outlet />;

  const active = memberships.filter((m) => m.status === 'active');
  if (active.length === 0 && invitations.length === 0 && platformAdmin) {
    return <Navigate to="/platform" replace />;
  }

  return (
    <Navigate to="/select-organization" replace state={{ from: location.pathname + location.search }} />
  );
}
