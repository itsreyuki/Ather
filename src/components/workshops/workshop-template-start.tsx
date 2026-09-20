import Link from "next/link";

type Template = { id: string; name: string; workshopType: string | null; category: string | null; criteria: Array<{ id: string }> };

export function WorkshopTemplateStart({ templates }: { templates: Template[] }) {
  return <section className="panel template-start-panel">
    <div className="panel-header"><div><h2 className="panel-title">ابدأ بسرعة</h2><p className="panel-caption">اختر قالبًا محفوظًا لتعبئة المعلومات والمعايير، أو ابدأ ورشة من الصفر.</p></div><Link className="button button-secondary" href="/dashboard/workshops/new">إنشاء من الصفر</Link></div>
    {templates.length === 0 ? <p className="template-empty">لا توجد قوالب محفوظة بعد. يمكنك حفظ أي ورشة لاحقًا كقالب.</p> : <div className="template-card-grid">{templates.map((template) => <Link className="template-card" href={`/dashboard/workshops/new?templateId=${template.id}`} key={template.id}><span className="template-card-kicker">قالب ورشة</span><strong>{template.name}</strong><small>{template.category || template.workshopType || "مخصص"} · {template.criteria.length.toLocaleString("ar-SA")} معايير</small><span className="text-link">البدء من هذا القالب ←</span></Link>)}</div>}
  </section>;
}
