import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { finalizePostAssessment } from "@/src/lib/workshop-service";
import { Permission } from "@/src/lib/permissions";

const schema = z.object({ confirmation: z.literal("اعتماد التقييمات وإنهاء قياس الورشة") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsFinalize);
  if (denied) return denied;
  const { id } = await params;
  if (!schema.safeParse(await request.json().catch(() => null)).success)
    return NextResponse.json({ error: "يجب تأكيد اعتماد التقييمات البعدية" }, { status: 400 });
  try {
    const report = await finalizePostAssessment(session.membership.schoolId, id, session.user.id);
    return NextResponse.json({
      completed: true,
      reportId: report.id,
      nextPath: `/dashboard/workshops/${id}`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code.includes("INCOMPLETE") || code.includes("NOT_READY") ? 422 : 409;
    return NextResponse.json(
      {
        error:
          code === "POST_ASSESSMENT_INCOMPLETE"
            ? "أكمل جميع التقييمات البعدية قبل الاعتماد"
            : code === "WORKSHOP_NOT_READY"
              ? "التقييم البعدي غير متاح حاليًا"
              : "تعذر إنهاء قياس الورشة",
      },
      { status },
    );
  }
}
