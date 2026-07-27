import type { Metadata } from "next";
import AppShell from "@/components/app-shell";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "Cortex AI Lab",
  description: "Enterprise AI Learning Lab — build and test AI capabilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
