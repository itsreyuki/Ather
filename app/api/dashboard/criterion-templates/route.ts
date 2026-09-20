import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const criterion = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(120).optional(),
  guidance: z.string().trim().max(2000).optional(),
  defaultWeight: z.number().min(0).max(100).optional(),
});
const schema = z.object({
  templateName: z.string().trim().min(2).max(160),
  criteria: z.array(criterion).min(1).max(50),
});

export async function GET() {
  const session = await getSessionContext();
  const denied = assertApiPermission(session, Permission.WorkshopsRead);
  if (denied) return denied;
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const templates = await db.criterionTemplate.findMany({
    where: { schoolId: session.membership.schoolId },
    orderBy: [{ templateName: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ templates });
}
export async function POST(request: Request) {
  const session = await getSessionContext();
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات القالب غير صالحة" }, { status: 400 });
  const templates = await db.criterionTemplate.createMany({
    data: parsed.data.criteria.map((item) => ({
      schoolId: session.membership!.schoolId,
      templateName: parsed.data.templateName,
      name: item.name,
      description: item.description || null,
      category: item.category || null,
      guidance: item.guidance || null,
      defaultWeight: item.defaultWeight ?? null,
    })),
  });
  return NextResponse.json({ created: templates.count }, { status: 201 });
}
