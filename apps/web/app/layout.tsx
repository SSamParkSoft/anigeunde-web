import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { HeaderAuth } from "@/components/header-auth";
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
        <footer className="site-footer">
          <div className="footer-brand">
            <strong><BrandLogo inverse /></strong>
            <p>다른 생각을 이기는 대신,<br />더 잘 이해하는 곳.</p>
          </div>
          <nav className="footer-policy-links" aria-label="서비스 정책">
            <span>정책</span>
            <Link href="/terms">이용약관</Link>
            <Link className="privacy-link" href="/privacy#policy-top">개인정보 처리방침</Link>
            <Link href="/community-guidelines">커뮤니티 운영정책</Link>
            <i />
            <span>신고·도움</span>
            <Link href="/rights">권리침해 신고 안내</Link>
          </nav>
          <div className="footer-company">
            <p className="footer-operator">아니근데는 <b>주식회사 콘텐트럭</b>이 만들고 운영합니다.</p>
            <dl>
              <div><dt>대표</dt><dd>박종인</dd></div>
              <div><dt>사업자등록번호</dt><dd>614-87-03791</dd></div>
              <div><dt>문의</dt><dd><a href="mailto:ssamso8282@gmail.com">ssamso8282@gmail.com</a></dd></div>
              <div className="footer-address"><dt>사업장 주소</dt><dd>경기도 안산시 상록구 한양대학로 55, 제5공학관 지하1층 소프트웨어창업실 2호(사동)</dd></div>
            </dl>
          </div>
          <div className="footer-meta">
            <p>참여 결과는 회원 계정 기준이며 과학적 여론조사가 아닙니다.<br />전체 사회나 실제 사람 수를 대표하지 않습니다.</p>
            <span>© 2026 CONTENTRUCK INC.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
