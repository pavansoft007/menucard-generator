import type { ReactNode } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark';
import CategoryIcon from '@mui/icons-material/Category';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import PaletteIcon from '@mui/icons-material/Palette';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

export interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  phase: number; // roadmap phase in which the module is delivered
  adminOnly?: boolean;
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon />, phase: 1 },
  { label: 'Restaurant Settings', path: '/restaurant', icon: <StorefrontIcon />, phase: 2 },
  { label: 'Logo Management', path: '/logos', icon: <BrandingWatermarkIcon />, phase: 2 },
  { label: 'Menu Categories', path: '/categories', icon: <CategoryIcon />, phase: 2 },
  { label: 'Menu Items', path: '/items', icon: <RestaurantMenuIcon />, phase: 2 },
  { label: 'Image Library', path: '/media', icon: <PhotoLibraryIcon />, phase: 2 },
  { label: 'Backgrounds', path: '/backgrounds', icon: <WallpaperIcon />, phase: 3 },
  { label: 'Theme & Design', path: '/themes', icon: <PaletteIcon />, phase: 3 },
  { label: 'Combos', path: '/combos', icon: <LocalOfferIcon />, phase: 3 },
  { label: 'Menu Sections', path: '/sections', icon: <ViewAgendaIcon />, phase: 3 },
  { label: 'Page Builder', path: '/pages', icon: <AutoStoriesIcon />, phase: 3 },
  { label: 'Templates', path: '/templates', icon: <DashboardCustomizeIcon />, phase: 4 },
  { label: 'Menu Preview', path: '/preview', icon: <VisibilityIcon />, phase: 4 },
  { label: 'PDF Export', path: '/export', icon: <PictureAsPdfIcon />, phase: 5 },
  { label: 'Users', path: '/users', icon: <GroupIcon />, phase: 6, adminOnly: true },
  { label: 'App Settings', path: '/settings', icon: <SettingsIcon />, phase: 6 },
];
