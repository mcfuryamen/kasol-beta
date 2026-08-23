import { signal } from "@preact/signals";
import { id } from "./id";
import { en } from "./en";

export type Lang = "id" | "en";
export const currentLang = signal<Lang>("id");

const translations = { id, en };

export function t(key: string): string {
  const lang = currentLang.value;
  const keys = key.split(".");
  let obj: any = translations[lang];
  for (const k of keys) {
    if (obj == null) break;
    obj = obj[k];
  }
  if (typeof obj === "string") return obj;
  // Fallback to id
  let fallback: any = translations["id"];
  for (const k of keys) {
    if (fallback == null) break;
    fallback = fallback[k];
  }
  return typeof fallback === "string" ? fallback : key;
}

export function setLang(lang: Lang) {
  currentLang.value = lang;
  localStorage.setItem("lang", lang);
}

// Load saved language
const saved = localStorage.getItem("lang") as Lang | null;
if (saved && (saved === "id" || saved === "en")) currentLang.value = saved;
