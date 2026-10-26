'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Beralih ke Mode Terang (Light)' : 'Beralih ke Mode Gelap (Dark)'}
      className={`p-2 rounded-xl transition-all cursor-pointer border ${
        theme === 'dark'
          ? 'bg-[#2A231F] text-[#F59E0B] border-[#3D332D] hover:bg-[#382F28]'
          : 'bg-[#FAF7F2] text-[#4A2E18] border-[#E8DFD3] hover:bg-[#F3EDE2]'
      } ${className}`}
      aria-label="Toggle tema gelap/terang"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
