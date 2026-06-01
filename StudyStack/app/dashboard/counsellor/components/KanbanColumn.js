"use client";

import { useState } from "react";
import LeadCard from "./LeadCard";

const COLUMN_META = {
  new: {
    title: "New Leads",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    accent: "from-blue-500 to-blue-600",
    dot: "bg-blue-500",
  },
  in_progress: {
    title: "In Progress",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    accent: "from-amber-500 to-orange-500",
    dot: "bg-amber-500",
  },
  follow_up: {
    title: "Follow Up",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: "from-purple-500 to-violet-500",
    dot: "bg-purple-500",
  },
  completed: {
    title: "Completed",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: "from-emerald-500 to-green-500",
    dot: "bg-emerald-500",
  },
};

export default function KanbanColumn({ status, leads, onStatusChange }) {
  const meta = COLUMN_META[status] || COLUMN_META.new;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId && onStatusChange) {
      onStatusChange(leadId, status);
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <h3 className="font-semibold text-sm text-gray-800 dark:text-white">{meta.title}</h3>
          <span className="flex items-center justify-center text-[10px] font-bold w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300">
            {leads.length}
          </span>
          <span className="ml-1 text-gray-400 dark:text-gray-500">→</span>
        </div>
        <button className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Cards Container */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-260px)] pr-1 custom-dashboard-scrollbar flex-1 min-h-[350px] rounded-xl transition-all duration-200 border-2 ${
          isDragOver
            ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-dashed border-emerald-500/40 p-2"
            : "border-transparent"
        }`}
      >
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">No leads in this stage</p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onStatusChange={onStatusChange} columnStatus={status} />
          ))
        )}
      </div>
    </div>
  );
}

