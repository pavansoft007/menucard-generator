import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardActionArea, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { navItems } from '../../components/layout/navItems';
import { useAuthStore } from '../../store/authStore';
import { dashboardService, keys } from '../../services/menuService';
import { ErrorAlert } from '../../components/common';

function Stat({ label, value, hint, to }: { label: string; value: string | number | undefined; hint?: string; to?: string }) {
  const body = (
    <CardContent>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {value === undefined ? <Skeleton width={60} height={44} /> : (
        <Typography variant="h4" fontWeight={800} color="primary.main">
          {value}
        </Typography>
      )}
      {hint && (
        <Typography variant="caption" color="text.disabled">
          {hint}
        </Typography>
      )}
    </CardContent>
  );
  return (
    <Card variant="outlined">
      {to ? <CardActionArea component={RouterLink} to={to}>{body}</CardActionArea> : body}
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const stats = useQuery({ queryKey: keys.stats, queryFn: dashboardService.stats });
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Typography variant="h4" fontWeight={800}>
          Welcome, {user?.name}
        </Typography>
        <Typography color="text.secondary">Golden Crunch menu builder</Typography>
      </div>

      {stats.isError && <ErrorAlert error={stats.error} onRetry={() => stats.refetch()} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Categories" value={s?.totalCategories} to="/categories" />
        <Stat label="Menu items" value={s?.totalItems} to="/items" />
        <Stat label="Active items" value={s?.activeItems} />
        <Stat label="Inactive items" value={s?.inactiveItems} />
        <Stat label="Uploaded images" value={s?.totalImages} to="/media" />
        <Stat label="Menu pages" value={s?.totalPages} to="/pages" />
        <Stat label="Last published" value={s ? (s.lastPublishedAt ? new Date(s.lastPublishedAt).toLocaleDateString() : 'Never') : undefined} to="/pages" />
        <Stat label="Last generated menu" value={s ? (s.lastGeneratedMenu ?? 'Never') : undefined} hint={s && !s.lastGeneratedMenu ? 'PDF export arrives in Phase 5' : undefined} />
      </div>

      <div>
        <Typography variant="h6" fontWeight={700} mb={1.5}>
          Modules
        </Typography>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {navItems
            .filter((n) => n.path !== '/')
            .map((n) => (
              <Card key={n.path} variant="outlined">
                <CardActionArea component={RouterLink} to={n.path}>
                  <CardContent className="flex items-center gap-3">
                    {n.icon}
                    <Typography flex={1} fontWeight={600}>
                      {n.label}
                    </Typography>
                    {n.phase > 3 && <Chip size="small" label={`Phase ${n.phase}`} />}
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
