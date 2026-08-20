"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/issues/")) return null;

  return (
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
      </div>
      <div className="footer-meta">
        <p>참여 결과는 회원 계정 기준이며 과학적 여론조사가 아닙니다.<br />전체 사회나 실제 사람 수를 대표하지 않습니다.</p>
        <span>© 2026 CONTENTRUCK INC.</span>
      </div>
    </footer>
  );
}
