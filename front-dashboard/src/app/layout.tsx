// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import Providers from './providers';

export const metadata = {
  title: 'DigiSmart Manager',
  description: 'DigiSmart Manager',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <head>
        {/* Inject runtime configuration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__RUNTIME_CONFIG__ = {
                BACKEND_URL: '${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000'}',
                FRONTEND_URL: '${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://162.19.25.155:3000'}',
                IS_DEVELOPMENT: '${process.env.NODE_ENV === 'development'}',
                IS_PRODUCTION: '${process.env.NODE_ENV === 'production'}'
              };
              console.log('🔧 Runtime configuration injected:', window.__RUNTIME_CONFIG__);
            `,
          }}
        />
      </head>
      <body>
        <Providers session={session}>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
