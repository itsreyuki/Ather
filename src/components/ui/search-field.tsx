import { Search } from "lucide-react";

export function SearchField({ label = "بحث", placeholder = "ابحث..." }: { label?: string; placeholder?: string }) {
  return <label className="search-field"><span className="sr-only">{label}</span><Search size={16} aria-hidden="true" /><input type="search" placeholder={placeholder} /></label>;
}
