"use client";

import { useState } from "react";

/** One-tap WhatsApp share of the committee's join link, plus copy. */
export default function ShareJoinLink({ committeeName, joinCode }: { committeeName: string; joinCode: string }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = () => `${window.location.origin}/join/${joinCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked - WhatsApp share still works
    }
  }

  function shareLink() {
    const text = `${committeeName} is on the app 🪙 Tap to join with your Google account and pick your name: ${joinUrl()}\n\nOn committee day you can bid live from your phone.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="btn-primary min-h-11 flex-1 bg-[#1f8f4e] hover:bg-[#187a41]" onClick={shareLink}>
        💬 Share join link on WhatsApp
      </button>
      <button type="button" className="btn-secondary min-h-11" onClick={copyLink}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
