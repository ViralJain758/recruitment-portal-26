import { Users, Clock3, CheckCircle2, XCircle } from "lucide-react";

const STAT_CONFIG = [
  { value: "All", title: "Total", key: "total", icon: Users, modifier: "" },
  { value: "Pending", title: "Pending", key: "pending", icon: Clock3, modifier: "stat-card--pending" },
  { value: "Shortlisted", title: "Shortlisted", key: "shortlisted", icon: CheckCircle2, modifier: "stat-card--shortlisted" },
  { value: "Rejected", title: "Rejected", key: "rejected", icon: XCircle, modifier: "stat-card--rejected" },
];

export default function StatsGrid({ stats, statusFilter, setStatusFilter }) {
  return (
    <div className="stats-grid">
      {STAT_CONFIG.map(({ value, title, key, icon: Icon, modifier }) => (
        <div
          key={value}
          className={`stat-card ${modifier} ${statusFilter === value ? "active" : ""}`}
          onClick={() => setStatusFilter(value)}
        >
          <span className="stat-card-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={2} />
          </span>
          <div className="stat-card-body">
            <h3>{title}</h3>
            <p>{stats[key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
