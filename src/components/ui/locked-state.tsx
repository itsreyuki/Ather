import { LockKeyhole } from "lucide-react";

export function LockedState({ title = "هذا القسم مقفل", description = "لا يمكن تعديل البيانات بعد اعتماد الورشة." }: { title?: string; description?: string }) {
  return <div className="locked-state"><LockKeyhole size={18} /><div><strong>{title}</strong><p>{description}</p></div></div>;
}
