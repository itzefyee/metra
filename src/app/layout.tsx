import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import MetraBotAssistant from "@/components/chatbot/MetraBotAssistant";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Metra - AI-Powered CAD Generation",
  description: "Transform your ideas into production-ready technical drawings with cutting-edge AI technology.",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' }
    ]
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <QueryProvider>
          <ConvexClientProvider>
            <AuthProvider>
              {children}
              <MetraBotAssistant />
            </AuthProvider>
          </ConvexClientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
