// src/components/CoachActionCards.tsx
import React from 'react';
import { Activity, HelpCircle, Trophy } from 'lucide-react';

export type FocusItem = {
  user_id: string;
  name: string;
  category: 'risk' | 'checkin' | 'praise';
  reason: string;
  meta?: string;
};

type CoachActionCardsProps = {
  focusItems: FocusItem[];
  riskHigh: number;
  riskCaution: number;
  onOpenAthlete: (item: { user_id: string }) => void;
};

function ActionCard({
  title,
  count,
  icon: Icon,
  borderColor,
  bgColor,
  hoverBgColor,
  iconBgColor,
  textColor,
  items,
  onOpenAthlete,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  borderColor: string;
  bgColor: string;
  hoverBgColor: string;
  iconBgColor: string;
  textColor: string;
  items: FocusItem[];
  onOpenAthlete: (item: { user_id: string }) => void;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${borderColor} p-4 transition-colors`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-2 ${iconBgColor} rounded-lg`}>
          <Icon className={`w-4 h-4 ${textColor}`} />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{count}人</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map(it => (
          <li key={it.user_id}>
            <button
              onClick={() => onOpenAthlete({ user_id: it.user_id })}
              className={`w-full text-left px-3 py-2 rounded-lg ${bgColor} ${hoverBgColor} transition-colors`}
            >
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.name}</div>
              <div className={`text-xs ${textColor}`}>
                {it.reason}{it.meta ? ` (${it.meta})` : ''}
              </div>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">該当なし</li>
        )}
      </ul>
    </div>
  );
}

export function CoachActionCards({ focusItems, riskHigh, riskCaution, onOpenAthlete }: CoachActionCardsProps) {
  const riskItems = focusItems.filter(it => it.category === 'risk');
  const checkinItems = focusItems.filter(it => it.category === 'checkin');
  const praiseItems = focusItems.filter(it => it.category === 'praise');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ActionCard
        title="要注意"
        count={riskHigh + riskCaution}
        icon={Activity}
        borderColor="border-red-200 dark:border-red-800"
        bgColor="bg-red-50 dark:bg-red-900/20"
        hoverBgColor="hover:bg-red-100 dark:hover:bg-red-900/30"
        iconBgColor="bg-red-100 dark:bg-red-900/30"
        textColor="text-red-600 dark:text-red-400"
        items={riskItems}
        onOpenAthlete={onOpenAthlete}
      />
      <ActionCard
        title="声かけ推奨"
        count={checkinItems.length}
        icon={HelpCircle}
        borderColor="border-amber-200 dark:border-amber-800"
        bgColor="bg-amber-50 dark:bg-amber-900/20"
        hoverBgColor="hover:bg-amber-100 dark:hover:bg-amber-900/30"
        iconBgColor="bg-amber-100 dark:bg-amber-900/30"
        textColor="text-amber-600 dark:text-amber-400"
        items={checkinItems}
        onOpenAthlete={onOpenAthlete}
      />
      <ActionCard
        title="好調・称賛"
        count={praiseItems.length}
        icon={Trophy}
        borderColor="border-emerald-200 dark:border-emerald-800"
        bgColor="bg-emerald-50 dark:bg-emerald-900/20"
        hoverBgColor="hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
        iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
        textColor="text-emerald-600 dark:text-emerald-400"
        items={praiseItems}
        onOpenAthlete={onOpenAthlete}
      />
    </div>
  );
}
