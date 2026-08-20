"use client";

import Script from "next/script";
import { useState } from "react";

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY = "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://anigeunde.bukae.co.kr").replace(/\/$/, "");

type KakaoShareOptions = {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    link: { mobileWebUrl: string; webUrl: string };
  };
  itemContent: {
    profileText: string;
    profileImageUrl: string;
  };
  buttons: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
};

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (options: KakaoShareOptions) => void };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export function IssueShare({ slug, question }: { slug: string; question: string }) {
  const javascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const [sdkReady, setSdkReady] = useState(false);
  const [feedback, setFeedback] = useState("");
  const shareUrl = `${SITE_URL}/issues/${encodeURIComponent(slug)}`;

  function initializeKakao() {
    if (!javascriptKey || !window.Kakao) return;
    if (!window.Kakao.isInitialized()) window.Kakao.init(javascriptKey);
    setSdkReady(window.Kakao.isInitialized());
  }

  async function fallbackShare() {
    if (navigator.share) {
      await navigator.share({
        title: "친구야, 너는 어떻게 생각해?",
        text: question,
        url: shareUrl,
      });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setFeedback("링크 복사 완료");
    window.setTimeout(() => setFeedback(""), 1800);
  }

  async function share() {
    setFeedback("");
    if (sdkReady && window.Kakao) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "친구야, 너는 어떻게 생각해?",
          description: question,
          imageUrl: `${SITE_URL}/share-card`,
          imageWidth: 1200,
          imageHeight: 630,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        itemContent: {
          profileText: "아니근데",
          profileImageUrl: `${SITE_URL}/brand/anigeunde-mark-512.png`,
        },
        buttons: [
          {
            title: "내 생각 고르기",
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
        ],
      });
      return;
    }
    try {
      await fallbackShare();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setFeedback("공유하지 못했어요");
    }
  }

  return (
    <aside className="issue-share-cta" aria-label="친구에게 주제 공유">
      {javascriptKey ? (
        <Script
          src={KAKAO_SDK_URL}
          integrity={KAKAO_SDK_INTEGRITY}
          crossOrigin="anonymous"
          strategy="afterInteractive"
          onLoad={initializeKakao}
        />
      ) : null}
      <div>
        <span>같이 얘기하고 싶은 친구가 있나요?</span>
        <b>“너는 어떻게 생각해?”</b>
      </div>
      <button type="button" onClick={() => void share()}>
        <span className="kakao-share-symbol" aria-hidden="true" />
        {feedback || "카톡으로 물어보기"}
      </button>
    </aside>
  );
}
