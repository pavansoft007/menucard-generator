import { useLocation } from 'react-router-dom';
import EmptyState from '../../components/EmptyState';
import { navItems } from '../../components/layout/navItems';

export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = navItems.find((n) => n.path === pathname);
  return (
    <EmptyState
      title={item ? `${item.label} – not built yet` : 'Page not found'}
      description={item ? `This module is scheduled for Phase ${item.phase} of the roadmap.` : 'That page does not exist.'}
    />
  );
}
