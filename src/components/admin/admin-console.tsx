"use client";

import { Clipboard, Copy, KeyRound, LogOut, RefreshCw, ShieldCheck, Users, School, Workflow, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AdminConsoleProps = { accessKey: string };
type Overview = { stats: { schools: number; activeSchools: number; users: number; staff: number; workshops: number; completedReports: number }; licenses: { total: number; created: number; redeemed: number; available: number; items: Array<{ id: string; codeLast4: string; label: string | null; status: string; createdAt: string; redeemedAt: string | null }> }; activities: Array<{ label: string; createdAt: string }> };

const number = (value: number) => value.toLocaleString("ar-SA");
const date = (value: string) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function AdminConsole({ accessKey }: AdminConsoleProps) {
  const endpoint = `/api/internal/${encodeURIComponent(accessKey)}`;
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [label, setLabel] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) { setAuthenticated(false); return; }
    setOverview(await response.json() as Overview); setAuthenticated(true);
  }, [endpoint]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "login", secret }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? "تعذر الدخول"); else { setSecret(""); await load(); }
    setBusy(false);
  }

  async function createCodes(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNewCodes([]);
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-license", quantity: Number(quantity), label }) });
    const data = await response.json() as { error?: string; items?: Array<{ code: string }> };
    if (!response.ok) setError(data.error ?? "تعذر إنشاء الأكواد"); else { setNewCodes((data.items ?? []).map((item) => item.code)); setLabel(""); await load(); }
    setBusy(false);
  }

  async function revoke(id: string) {
    if (!window.confirm("هل تريد إلغاء هذا الكود؟ لن يمكن استخدامه بعد ذلك.")) return;
    setBusy(true); await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); await load(); setBusy(false);
  }

  async function copyCodes() { if (newCodes.length) await navigator.clipboard.writeText(newCodes.join("\n")); }

  if (!authenticated || !overview) return <main className="admin-page"><section className="admin-login"><span className="admin-brand"><ShieldCheck size={20} /> ATHAR OPS</span><h1>لوحة الإدارة الداخلية</h1><p>أدخل رمز الإدارة السري للمتابعة.</p><form onSubmit={login} className="auth-form"><label className="field"><span>رمز الإدارة</span><input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary" disabled={busy}>{busy ? "جارٍ التحقق..." : "فتح اللوحة"}</button></form></section></main>;

  return <main className="admin-page"><header className="admin-header"><div><span className="admin-brand"><ShieldCheck size={20} /> ATHAR OPS</span><h1>لوحة الإدارة الداخلية</h1><p>مؤشرات تشغيلية عامة وإدارة أكواد الرخص دون عرض بيانات شخصية.</p></div><div className="admin-header-actions"><button className="button button-secondary" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> تحديث</button><button className="button button-secondary" onClick={async () => { await fetch(endpoint, { method: "DELETE" }); setAuthenticated(false); }}><LogOut size={15} /> خروج</button></div></header>
    {error && <div className="form-error admin-alert" role="alert">{error}</div>}
    <section className="admin-stats"><AdminStat icon={<School size={17} />} label="المدارس" value={overview.stats.schools} note={`${number(overview.stats.activeSchools)} نشطة`} /><AdminStat icon={<Users size={17} />} label="المستخدمون" value={overview.stats.users} note={`${number(overview.stats.staff)} منسوب`} /><AdminStat icon={<Workflow size={17} />} label="الورش" value={overview.stats.workshops} note="دون السجلات المحذوفة" /><AdminStat icon={<FileText size={17} />} label="التقارير" value={overview.stats.completedReports} note="Snapshots مكتملة" /></section>
    <div className="admin-grid"><section className="admin-card"><div className="admin-card-heading"><div><span className="admin-kicker">عرض الإطلاق</span><h2>المقاعد والأكواد</h2></div><KeyRound size={18} /></div><div className="admin-license-summary"><strong>{number(overview.licenses.available)}</strong><span>مقاعد متبقية من {number(overview.licenses.total)}</span><small>{number(overview.licenses.redeemed)} مستخدمة · {number(overview.licenses.total - overview.licenses.redeemed)} غير مستخدمة</small></div><form className="admin-license-form" onSubmit={createCodes}><label className="field"><span>عدد الأكواد</span><input type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="field"><span>ملاحظة داخلية، اختياري</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="اسم العميل أو الفاتورة" /></label><button className="button button-primary" disabled={busy}><KeyRound size={15} /> إنشاء أكواد رخصة</button></form>{newCodes.length > 0 && <div className="admin-new-codes"><div><strong>احفظ الأكواد الآن</strong><span>تظهر كاملة مرة واحدة فقط.</span></div><button type="button" className="button button-secondary button-compact" onClick={() => void copyCodes()}><Copy size={14} /> نسخ</button>{newCodes.map((code) => <code key={code}><Clipboard size={13} />{code}</code>)}</div>}</section><section className="admin-card"><div className="admin-card-heading"><div><span className="admin-kicker">Audit summary</span><h2>النشاط الأخير</h2></div><RefreshCw size={18} /></div><div className="admin-activity-list">{overview.activities.length ? overview.activities.map((item, index) => <div className="admin-activity" key={`${item.createdAt}-${index}`}><span className="admin-activity-dot" /><div><strong>{item.label}</strong><small>{date(item.createdAt)}</small></div></div>) : <p className="admin-muted">لا توجد أنشطة بعد.</p>}</div></section></div>
    <section className="admin-card admin-license-table"><div className="admin-card-heading"><div><span className="admin-kicker">License inventory</span><h2>حالة أكواد الرخص</h2></div><KeyRound size={18} /></div><div className="admin-table-wrap"><table><thead><tr><th>الكود</th><th>الملاحظة</th><th>الحالة</th><th>التاريخ</th><th /></tr></thead><tbody>{overview.licenses.items.map((item) => <tr key={item.id}><td dir="ltr">•••• {item.codeLast4}</td><td>{item.label || "—"}</td><td><span className={`admin-status admin-status-${item.status.toLowerCase()}`}>{item.status === "ACTIVE" ? "متاح" : item.status === "REDEEMED" ? "مستخدم" : "ملغى"}</span></td><td>{item.redeemedAt ? date(item.redeemedAt) : date(item.createdAt)}</td><td>{item.status === "ACTIVE" && <button className="admin-revoke" type="button" onClick={() => void revoke(item.id)} disabled={busy}>إلغاء</button>}</td></tr>)}</tbody></table></div></section>
  </main>;
}

function AdminStat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) { return <div className="admin-stat"><span className="admin-stat-icon">{icon}</span><span>{label}</span><strong>{number(value)}</strong><small>{note}</small></div>; }
