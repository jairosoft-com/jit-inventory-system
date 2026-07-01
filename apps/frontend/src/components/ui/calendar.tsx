import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium text-[#0f172a]',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-[#64748b] rounded-md w-8 font-normal text-[0.8rem] text-center',
        week: 'flex w-full mt-2',
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-[rgba(37,99,235,0.08)]',
          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
          '[&:has([aria-selected].day-range-start)]:rounded-l-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
        ),
        range_start:
          'day-range-start [&>button]:bg-[#2563eb] [&>button]:text-white [&>button]:hover:bg-[#1d4ed8] [&>button]:hover:text-white',
        range_end:
          'day-range-end [&>button]:bg-[#2563eb] [&>button]:text-white [&>button]:hover:bg-[#1d4ed8] [&>button]:hover:text-white',
        selected:
          '[&>button]:bg-[#2563eb] [&>button]:text-white [&>button]:hover:bg-[#1d4ed8] [&>button]:hover:text-white',
        today: '[&>button]:bg-[#f1f5f9] [&>button]:text-[#0f172a] [&>button]:font-semibold',
        outside: '[&>button]:text-[#94a3b8] [&>button]:opacity-50',
        disabled: '[&>button]:text-[#94a3b8] [&>button]:opacity-50',
        range_middle:
          'aria-selected:bg-[rgba(37,99,235,0.08)] aria-selected:text-[#0f172a]',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
