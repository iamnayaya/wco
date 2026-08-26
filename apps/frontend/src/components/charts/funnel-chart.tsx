'use client';

import { cn } from '../../lib/utils/format';

interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

const DEFAULT_COLORS = [
  'bg-sky-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-cyan-500',
];

function getBarColor(color?: string, index?: number): string {
  if (color) return color;
  return DEFAULT_COLORS[(index ?? 0) % DEFAULT_COLORS.length];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (!steps.length) return null;

  const maxValue = steps[0].value;

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
        const colorClass = getBarColor(step.color, i);

        return (
          <div key={`${step.label}-${i}`} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {step.label}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {step.value.toLocaleString()}{' '}
                <span className="text-xs">({percentage.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
              <div
                className={cn(
                  'h-full rounded-md transition-all duration-500 ease-out',
                  colorClass,
                )}
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
