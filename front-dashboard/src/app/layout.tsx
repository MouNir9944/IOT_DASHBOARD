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
      <body>
        <Providers session={session}>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
