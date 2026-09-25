import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { parseProfessionalPlanWorkbook } from "@/src/lib/professional-growth-plans";
import { Permission } from "@/src/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireDashboardContext({ permission: Permission.ProfessionalGrowthPlansWrite });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "اختر ملف Excel أولًا." }, { status: 400 });
    const staff = await db.staffMember.findMany({
      where: { schoolId: session.membership!.schoolId, active: true },
      select: { id: true, fullName: true, jobTitle: true },
      orderBy: { fullName: "asc" },
    });
    const programs = await parseProfessionalPlanWorkbook(file, staff);
    return NextResponse.json({
      programs: programs.map((program) => ({
        ...program,
        match: {
          state: program.match.state,
          staffId: program.match.staffId,
          candidates: program.match.candidates,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحليل نموذج الخطة." },
      { status: 422 },
    );
  }
}
