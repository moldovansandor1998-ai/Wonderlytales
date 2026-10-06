import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/ui";

export const metadata: Metadata = { title: "Wonderly Tales Studio", description: "3D gyerek-animációs gyártóstúdió" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="hu"><body><Shell>{children}</Shell></body></html>);
}
