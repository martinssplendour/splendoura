// components/groups/group-card.tsx
import { MapPin, Users, Calendar, Banknote } from "lucide-react";
import Link from "next/link";

// 1. Define the Group interface based on your database schema
export interface Group {
  id: number;
  title: string;
  activity_type: string;
  location: string;
  start_date: string;
  cost_type: "free" | "shared" | "fully_paid" | "custom";
  spots_left: number;
  max_participants: number;
}

// 2. Define the Props for the component
interface GroupCardProps {
  group: Group;
}

export default function GroupCard({ group }: GroupCardProps) {
  return (
    <Link href={`/groups/${group.id}`}>
      <div className="glass-card glass-interactive rounded-2xl p-5 flex flex-col h-full gap-4">
        {/* Header: Activity Type & Spots */}
        <div className="flex justify-between items-start">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
            {group.activity_type}
          </span>
          <div className="flex items-center gap-1 text-slate-500 text-sm">
            <Users size={16} />
            <span>{group.spots_left} spots left</span>
          </div>
        </div>

        {/* Title & Location */}
        <div>
          <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1">{group.title}</h3>
          <div className="flex items-center gap-1 text-slate-500 text-sm">
            <MapPin size={14} />
            <span>{group.location}</span>
          </div>
        </div>

        {/* Details Row */}
        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Cost</span>
            <div className="flex items-center gap-1 text-slate-700 font-semibold">
              <Banknote size={16} className="text-green-600" />
              <span className="capitalize">{group.cost_type.replace("_", " ")}</span>
            </div>
          </div>
          
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Date</span>
            <div className="flex items-center gap-1 text-slate-700 font-semibold">
              <Calendar size={16} className="text-blue-600" />
              <span>{new Date(group.start_date).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}