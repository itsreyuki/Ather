"use client";

import { FileBarChart, Search, UserRound, X, BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type Result = { id: string; title: string; subtitle: string; href: string };
type SearchResponse = { staff: Result[]; workshops: Result[]; reports: Result[] };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResponse>({ staff: [], workshops: [], reports: [] });
  const hasResults = results.staff.length + results.workshops.length + results.reports.length > 0;

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;
    const timer = window.setTimeout(async () => { const response = await fetch(`/api/dashboard/search?q=${encodeURIComponent(value)}`, { cache: "no-store" }); if (response.ok) setResults(await response.json() as SearchResponse); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function group(label: string, icon: ReactNode, items: Result[]) { if (!items.length) return null; return <div className="search-result-group"><span>{icon}{label}</span>{items.map((item) => <Link href={item.href} key={item.id} onClick={() => { setOpen(false); setQuery(""); }}><strong>{item.title}</strong><small>{item.subtitle}</small></Link>)}</div>; }

  return <div className="global-search"><div className="global-search-input"><Search size={15} /><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="ابحث عن موظف أو ورشة أو تقرير" aria-label="البحث العام" />{query && <button type="button" aria-label="مسح البحث" onClick={() => { setQuery(""); setOpen(false); }}><X size={13} /></button>}</div>{open && query.trim().length >= 2 && <><button className="search-scrim" aria-label="إغلاق نتائج البحث" onClick={() => setOpen(false)} /><div className="global-search-results">{hasResults ? <>{group("الموظفون", <UserRound size={13} />, results.staff)}{group("الورش", <BookOpen size={13} />, results.workshops)}{group("التقارير", <FileBarChart size={13} />, results.reports)}</> : <p>لا توجد نتائج مطابقة.</p>}</div></>}</div>;
}
