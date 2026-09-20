import type { ReactNode } from "react";

export function DataTable({ headers, children, empty }: { headers: string[]; children?: ReactNode; empty?: ReactNode }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{children || <tr><td colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>;
}
