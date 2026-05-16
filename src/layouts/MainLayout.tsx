import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppFooter } from '../components/AppFooter';
import { AppHeader } from '../components/AppHeader';
import { useAppThemeMode } from '../theme/themeMode';

export function MainLayout() {
  const { tokens } = useAppThemeMode();

  return (
    <Box
      sx={{
        backgroundColor: tokens.background,
        color: tokens.onBackground,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppHeader />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <AppFooter />
    </Box>
  );
}
