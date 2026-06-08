// Audience soundboard bank — funny ElevenLabs-generated SFX organized into
// 4 themed tabs. Each pad broadcasts its CDN URL so the host TV plays it.

import boing from "@/assets/audio/audience/cartoon_boing.mp3.asset.json";
import cuckoo from "@/assets/audio/audience/cartoon_cuckoo.mp3.asset.json";
import rimshot from "@/assets/audio/audience/cartoon_rimshot.mp3.asset.json";
import sadtrombone from "@/assets/audio/audience/cartoon_sadtrombone.mp3.asset.json";
import slidewhistle from "@/assets/audio/audience/cartoon_slidewhistle.mp3.asset.json";
import wahwah from "@/assets/audio/audience/cartoon_wahwah.mp3.asset.json";

import aww from "@/assets/audio/audience/crowd_aww.mp3.asset.json";
import boo from "@/assets/audio/audience/crowd_boo.mp3.asset.json";
import clap from "@/assets/audio/audience/crowd_clap.mp3.asset.json";
import gasp from "@/assets/audio/audience/crowd_gasp.mp3.asset.json";
import laughter from "@/assets/audio/audience/crowd_laughter.mp3.asset.json";
import ohhh from "@/assets/audio/audience/crowd_ohhh.mp3.asset.json";

import burp from "@/assets/audio/audience/gross_burp.mp3.asset.json";
import longfart from "@/assets/audio/audience/gross_longfart.mp3.asset.json";
import snothonk from "@/assets/audio/audience/gross_snothonk.mp3.asset.json";
import splat from "@/assets/audio/audience/gross_splat.mp3.asset.json";
import squelch from "@/assets/audio/audience/gross_squelch.mp3.asset.json";
import wetfart from "@/assets/audio/audience/gross_wetfart.mp3.asset.json";

import airhorn from "@/assets/audio/audience/meme_airhorn.mp3.asset.json";
import bruh from "@/assets/audio/audience/meme_bruh.mp3.asset.json";
import hitmarker from "@/assets/audio/audience/meme_hitmarker.mp3.asset.json";
import recordscratch from "@/assets/audio/audience/meme_recordscratch.mp3.asset.json";
import sadviolin from "@/assets/audio/audience/meme_sadviolin.mp3.asset.json";
import vineboom from "@/assets/audio/audience/meme_vineboom.mp3.asset.json";

export type AudiencePad = {
  id: string;
  label: string;
  emoji: string;
  url: string;
  volume: number;
};

export type AudienceTab = {
  id: "gross" | "cartoon" | "crowd" | "meme";
  label: string;
  emoji: string;
  color: string; // tailwind bg-*
  pads: AudiencePad[];
};

export const AUDIENCE_TABS: AudienceTab[] = [
  {
    id: "gross",
    label: "Gross",
    emoji: "🤢",
    color: "bg-lime-500",
    pads: [
      { id: "g_longfart", label: "Long Fart", emoji: "💨", url: longfart.url, volume: 0.9 },
      { id: "g_wetfart", label: "Wet Fart", emoji: "💦", url: wetfart.url, volume: 0.9 },
      { id: "g_burp", label: "Burp", emoji: "🍺", url: burp.url, volume: 0.9 },
      { id: "g_splat", label: "Splat", emoji: "🟢", url: splat.url, volume: 0.9 },
      { id: "g_squelch", label: "Squelch", emoji: "🦠", url: squelch.url, volume: 0.9 },
      { id: "g_snot", label: "Snot Honk", emoji: "🤧", url: snothonk.url, volume: 0.9 },
    ],
  },
  {
    id: "cartoon",
    label: "Cartoon",
    emoji: "🎪",
    color: "bg-amber-500",
    pads: [
      { id: "c_boing", label: "Boing", emoji: "🪀", url: boing.url, volume: 0.9 },
      { id: "c_slide", label: "Slide", emoji: "🎵", url: slidewhistle.url, volume: 0.9 },
      { id: "c_rimshot", label: "Rimshot", emoji: "🥁", url: rimshot.url, volume: 0.9 },
      { id: "c_sadtbone", label: "Sad Trombone", emoji: "🎺", url: sadtrombone.url, volume: 0.9 },
      { id: "c_wahwah", label: "Wah Wah", emoji: "😢", url: wahwah.url, volume: 0.9 },
      { id: "c_cuckoo", label: "Cuckoo", emoji: "🕰️", url: cuckoo.url, volume: 0.9 },
    ],
  },
  {
    id: "crowd",
    label: "Crowd",
    emoji: "👥",
    color: "bg-rose-500",
    pads: [
      { id: "cr_boo", label: "Boo", emoji: "👎", url: boo.url, volume: 0.95 },
      { id: "cr_clap", label: "Applause", emoji: "👏", url: clap.url, volume: 0.95 },
      { id: "cr_gasp", label: "Gasp", emoji: "😱", url: gasp.url, volume: 0.95 },
      { id: "cr_aww", label: "Awww", emoji: "🥺", url: aww.url, volume: 0.95 },
      { id: "cr_ohhh", label: "Ohhh!", emoji: "🤯", url: ohhh.url, volume: 0.95 },
      { id: "cr_laugh", label: "Laughter", emoji: "😂", url: laughter.url, volume: 0.95 },
    ],
  },
  {
    id: "meme",
    label: "Meme",
    emoji: "🚀",
    color: "bg-violet-500",
    pads: [
      { id: "m_vineboom", label: "Vine Boom", emoji: "💥", url: vineboom.url, volume: 0.95 },
      { id: "m_airhorn", label: "Airhorn", emoji: "📣", url: airhorn.url, volume: 0.9 },
      { id: "m_bruh", label: "Bruh", emoji: "😐", url: bruh.url, volume: 1 },
      { id: "m_scratch", label: "Record Scratch", emoji: "💿", url: recordscratch.url, volume: 0.9 },
      { id: "m_sadviolin", label: "Sad Violin", emoji: "🎻", url: sadviolin.url, volume: 0.85 },
      { id: "m_hitmarker", label: "Hitmarker", emoji: "🎯", url: hitmarker.url, volume: 0.9 },
    ],
  },
];

export function findPad(id: string): AudiencePad | null {
  for (const tab of AUDIENCE_TABS) {
    const p = tab.pads.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}
