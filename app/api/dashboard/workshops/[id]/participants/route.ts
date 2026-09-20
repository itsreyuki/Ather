import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/src/lib/auth";
import { assertApiPermission } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

const schema = z.object({ staffIds: z.array(z.string().min(1)).max(1000) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session?.membership) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const denied = assertApiPermission(session, Permission.WorkshopsWrite);
  if (denied) return denied;
  const { id } = await params;
  const workshop = await db.workshop.findFirst({
    where: { id, schoolId: session.membership.schoolId, deletedAt: null },
    select: { id: true, finalizedAt: true },
  });
  if (!workshop) return NextResponse.json({ error: "لم يتم العثور على الورشة" }, { status: 404 });
  if (workshop.finalizedAt) return NextResponse.json({ error: "الورشة معتمدة ومقفلة" }, { status: 409 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "قائمة المشاركين غير صالحة" }, { status: 400 });
  const staffIds = [...new Set(parsed.data.staffIds)];
  const activeStaff = await db.staffMember.findMany({
    where: { schoolId: session.membership.schoolId, id: { in: staffIds }, active: true },
    select: { id: true },
  });
  if (activeStaff.length !== staffIds.length)
    return NextResponse.json(
      { error: "تتضمن القائمة منسوبين غير نشطين أو غير تابعين للمدرسة" },
      { status: 422 },
    );
  await db.$transaction(async (tx) => {
    await tx.workshopParticipant.deleteMany({ where: { workshopId: id, staffId: { notIn: staffIds } } });
    if (staffIds.length) {
      const existing = await tx.workshopParticipant.findMany({
        where: { workshopId: id, staffId: { in: staffIds } },
        select: { staffId: true },
      });
      const existingIds = new Set(existing.map((participant) => participant.staffId));
      const newStaffIds = staffIds.filter((staffId) => !existingIds.has(staffId));
      if (newStaffIds.length) {
        await tx.workshopParticipant.createMany({
          data: newStaffIds.map((staffId) => ({ workshopId: id, staffId })),
        });
      }
    }
  });
  const participants = await db.workshopParticipant.findMany({
    where: { workshopId: id },
    select: { id: true, staffId: true },
  });
  return NextResponse.json({ selected: staffIds.length, participants });
}
