"use client";

import Image from "next/image";
import type { LoginProvider } from "@/lib/auth";

export function SocialLoginButtons({ busy, onSelect }: {
  busy: boolean;
  onSelect: (provider: LoginProvider) => void;
}) {
  return (
    <div className="social-login-buttons">
      <button className="google-login-button" type="button" onClick={() => onSelect("google")} disabled={busy}>
        <Image src="/auth/google-g.png" alt="" width={20} height={20} />
        <span className="google-login-label">Google 계정으로 로그인</span>
      </button>
      <button className="kakao-login-button" type="button" onClick={() => onSelect("kakao")} disabled={busy} aria-label="카카오 로그인">
        <Image src="/auth/kakao-login-large-wide.png" alt="" width={600} height={90} />
      </button>
    </div>
  );
}
