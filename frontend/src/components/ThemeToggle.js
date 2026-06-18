import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../App';

const ThemeToggle = () => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      data-testid="theme-toggle"
      onClick={toggle}
      className="p-2 rounded-sm transition-colors"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5 text-[#FBBF24]" /> : <Moon className="w-5 h-5 text-[#9CA3AF]" />}
    </button>
  );
};

export default ThemeToggle;
