"use client";

import Script from "next/script";
import { useState } from "react";

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY = "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://anigeunde.bukae.co.kr").replace(/\/$/, "");

type KakaoShareOptions = {
  objectType: "text";
  text: string;
  link: { mobileWebUrl: string; webUrl: string };
  buttons: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
};

function kakaoShareText(question: string) {
  const prefix = "친구야, 너는 어떻게 생각해?\n\n";
  const suffix = "\n\n— 아니근데";
  const availableLength = 200 - prefix.length - suffix.length;
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();
  const shortenedQuestion = normalizedQuestion.length > availableLength
    ? `${normalizedQuestion.slice(0, availableLength - 1)}…`
    : normalizedQuestion;
  return `${prefix}${shortenedQuestion}${suffix}`;
}

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
    try {
      if (!window.Kakao.isInitialized()) window.Kakao.init(javascriptKey);
      setSdkReady(window.Kakao.isInitialized());
    } catch {
      setSdkReady(false);
      setFeedback("공유 기능을 준비하지 못했어요");
    }
  }

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 1800);
  }

  async function nativeShare() {
    setFeedback("");
    if (navigator.share) {
      try {
        await navigator.share({
          title: "친구야, 너는 어떻게 생각해?",
          text: `친구야, 너는 어떻게 생각해?\n\n${question}\n\n— 아니근데`,
          url: shareUrl,
        });
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        showFeedback("공유하지 못했어요");
      }
      return;
    }
    await copyLink("공유창 대신 링크를 복사했어요");
  }

  async function copyLink(message = "링크를 복사했어요") {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showFeedback(message);
    } catch {
      showFeedback("링크를 복사하지 못했어요");
    }
  }

  async function shareKakao() {
    setFeedback("");
    if (javascriptKey) {
      if (!window.Kakao) {
        setFeedback("카카오톡 공유 준비 중");
        return;
      }
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(javascriptKey);
        window.Kakao.Share.sendDefault({
          objectType: "text",
          text: kakaoShareText(question),
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          buttons: [
            {
              title: "내 생각 고르기",
              link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
            },
          ],
        });
        return;
      } catch {
        setFeedback("카카오톡 공유 설정을 확인해주세요");
        return;
      }
    }
    await nativeShare();
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
          onReady={initializeKakao}
          onError={() => setFeedback("공유 기능을 불러오지 못했어요")}
        />
      ) : null}
      <div className="issue-share-copy">
        <span>같이 얘기하고 싶은 친구가 있나요?</span>
        <b>“너는 어떻게 생각해?”</b>
      </div>
      <div className="issue-share-actions">
        <button className="issue-share-button kakao-share-button" type="button" onClick={() => void shareKakao()} disabled={Boolean(javascriptKey) && !sdkReady} aria-busy={Boolean(javascriptKey) && !sdkReady}>
          <span className="kakao-share-symbol" aria-hidden="true" />
          <span className="share-label-long">{javascriptKey && !sdkReady ? "카카오톡 준비 중" : "카톡으로 물어보기"}</span>
          <span className="share-label-short">카카오톡</span>
        </button>
        <button className="issue-share-button native-share-button" type="button" onClick={() => void nativeShare()}>
          <svg className="native-share-symbol" aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="M21 3 9.8 14.2M21 3l-7.1 18-4.1-6.8L3 10.1 21 3Z" />
          </svg>
          <span className="share-label-long">DM·공유하기</span>
          <span className="share-label-short">DM·공유</span>
        </button>
        <button className="issue-share-button copy-share-button" type="button" onClick={() => void copyLink()}>
          링크 복사
        </button>
      </div>
      {feedback ? <span className="issue-share-feedback" role="status" aria-live="polite">{feedback}</span> : null}
    </aside>
  );
}
