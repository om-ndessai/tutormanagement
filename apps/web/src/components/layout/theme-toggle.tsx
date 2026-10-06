import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type Theme } from '@/providers/theme-provider';
import { switchTheme } from './theme-transition';

const OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" className="group">
          {resolvedTheme === 'dark' ? (
            <MoonIcon className="transition-transform duration-500 group-hover:-rotate-12" />
          ) : (
            <SunIcon className="transition-transform duration-700 group-hover:rotate-90" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={(event) => {
              // The new theme spreads out from the item that asked for it.
              const box = (event.target as HTMLElement).getBoundingClientRect?.();
              switchTheme(
                () => setTheme(value),
                box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined,
              );
            }}
            className={theme === value ? 'bg-accent text-accent-foreground' : undefined}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
