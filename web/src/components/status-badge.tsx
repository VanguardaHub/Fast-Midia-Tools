import { STATUS_COR, STATUS_ROTULO, type JobStatus } from "@/lib/formato";

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${STATUS_COR[status]}`}>{STATUS_ROTULO[status]}</span>;
}
