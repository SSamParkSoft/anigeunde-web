import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { HeaderAuth } from "@/components/header-auth";
import { SiteFooter } from "@/components/site-footer";
import "@ibm/plex-mono/css/ibm-plex-mono-default.css";
import "./globals.css";

const wantedSans = localFont({
  src: "./fonts/WantedSansVariable.woff2",
  variable: "--font-wanted-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://anigeunde.bukae.co.kr"),
  title: "아니근데 — 주제를 읽고, 내 입장을 말하다",
  description: "뉴스가 아니라 주제를 읽고 서로의 의견에 근데를 다는 토론 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={wantedSans.variable}>
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="아니근데 홈">
            <BrandLogo />
          </Link>
          <HeaderAuth />
        </header>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
