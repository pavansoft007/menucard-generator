import { useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Breadcrumbs,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { navItems } from './navItems';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { authService } from '../../services/authService';

const DRAWER_WIDTH = 252;

export default function AdminLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const { mode, toggleMode } = useUiStore();

  const current = navItems.find((n) => (n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)));

  const signOut = async () => {
    await authService.logout().catch(() => undefined);
    clear();
    navigate('/login', { replace: true });
  };

  const drawer = (
    <Box className="flex h-full flex-col">
      <Toolbar>
        <Typography fontWeight={800} sx={{ color: 'primary.main', letterSpacing: 1.5 }}>
          GOLDEN CRUNCH
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {navItems.map((n) => (
          <ListItemButton
            key={n.path}
            component={NavLink}
            to={n.path}
            end={n.path === '/'}
            onClick={() => setOpen(false)}
            sx={{ borderRadius: 2, mb: 0.25, '&.active': { bgcolor: 'action.selected', color: 'primary.main' } }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{n.icon}</ListItemIcon>
            <ListItemText primary={n.label} slotProps={{ primary: { fontSize: 14 } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box className="flex min-h-full">
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open navigation" sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }}>
            <Breadcrumbs>
              <Link component={RouterLink} to="/" underline="hover" color="inherit">
                Admin
              </Link>
              <Typography color="text.primary">{current?.label ?? 'Not found'}</Typography>
            </Breadcrumbs>
          </Box>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={toggleMode} aria-label="Toggle colour mode">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Avatar sx={{ width: 32, height: 32, mx: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <Tooltip title="Sign out">
            <IconButton onClick={signOut} aria-label="Sign out">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
