import Link from "next/link";
import type { ReactNode } from "react";

const policyLinks = [
  ["/terms", "이용약관"],
  ["/privacy", "개인정보 처리방침"],
  ["/community-guidelines", "커뮤니티 운영정책"],
  ["/rights", "권리침해 신고 안내"],
] as const;

export function PolicyPage({ title, description, children, plain = false, effectiveDate = "2026년 8월 18일", version = "1.0" }: {
  title: string;
  description: string;
  children: ReactNode;
  plain?: boolean;
  effectiveDate?: string;
  version?: string;
}) {
  return (
    <main id="policy-top" className={`policy-page ${plain ? "policy-page-plain" : ""}`}>
      <div className="policy-shell">
        <header className="policy-header">
          <span>ANIGEUNDE POLICY</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div><b>시행일</b> {effectiveDate} <i /> <b>버전</b> {version}</div>
        </header>
        <nav className="policy-nav" aria-label="정책 문서">
          {policyLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <article className="policy-content">{children}</article>
        <div className="policy-contact">
          <b>정책 관련 문의</b>
          <a href="mailto:ssamso8282@gmail.com">ssamso8282@gmail.com ↗</a>
        </div>
      </div>
    </main>
  );
}

export function PolicySection({ number, title, children }: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="policy-section" id={`section-${number}`}>
      <div className="policy-section-title"><span>{number}</span><h2>{title}</h2></div>
      <div className="policy-section-body">{children}</div>
    </section>
  );
}
