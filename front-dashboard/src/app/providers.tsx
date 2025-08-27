'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useTheme } from './contexts/ThemeContext';

interface ProvidersProps {
  children: ReactNode;
  session: any;
}

// Create a wrapper component that provides Material-UI theme
function MuiThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  
  const muiTheme = createTheme({
    palette: {
      mode: theme,
      background: {
        default: theme === 'dark' ? '#111827' : '#ffffff',
        paper: theme === 'dark' ? '#1f2937' : '#ffffff',
      },
      text: {
        primary: theme === 'dark' ? '#f9fafb' : '#111827',
        secondary: theme === 'dark' ? '#9ca3af' : '#6b7280',
      },
      divider: theme === 'dark' ? '#374151' : '#e5e7eb',
    },
  });

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <MuiThemeWrapper>
          <SessionProvider session={session}>{children}</SessionProvider>
        </MuiThemeWrapper>
      </LanguageProvider>
    </ThemeProvider>
  );
} 