import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";

export async function GET(request: Request) {
  const session = await requireDashboardContext();
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ staff: [], workshops: [], reports: [] });
  const schoolId = session.membership!.schoolId;
  const [staff, workshops, reports] = await Promise.all([
    db.staffMember.findMany({ where: { schoolId, OR: [{ fullName: { contains: query, mode: "insensitive" } }, { jobTitle: { contains: query, mode: "insensitive" } }, { specialization: { contains: query, mode: "insensitive" } }] }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" }, take: 6 }),
    db.workshop.findMany({ where: { schoolId, deletedAt: null, OR: [{ title: { contains: query, mode: "insensitive" } }, { facilitator: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }] }, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.reportSnapshot.findMany({ where: { schoolId, workshop: { deletedAt: null, title: { contains: query, mode: "insensitive" } } }, select: { id: true, generatedAt: true, workshop: { select: { id: true, title: true } } }, orderBy: { generatedAt: "desc" }, take: 6 }),
  ]);
  return NextResponse.json({ staff: staff.map((item) => ({ id: item.id, title: item.fullName, subtitle: item.jobTitle ?? "منسوب", href: `/dashboard/staff/${item.id}` })), workshops: workshops.map((item) => ({ id: item.id, title: item.title, subtitle: item.status, href: `/dashboard/workshops/${item.id}` })), reports: reports.map((item) => ({ id: item.id, title: item.workshop.title, subtitle: "تقرير أثر", href: `/dashboard/workshops/${item.workshop.id}/report` })) });
}
