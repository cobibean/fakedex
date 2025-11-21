'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, BarChart2, Trophy } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { label: 'Terminal', href: '/', icon: BarChart2 },
  { label: 'Profile', href: '/profile/me', icon: User },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy }, // Future
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={clsx(
        "fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-gray-800 transform transition-transform duration-200 ease-in-out md:transform-none flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between md:hidden">
           <span className="font-bold text-lg">Menu</span>
           <button onClick={onClose} className="text-gray-400">X</button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive 
                    ? "bg-gray-800 text-green-400 border border-gray-700" 
                    : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"
                )}
                onClick={() => onClose()}
              >
                <Icon className="w-5 h-5" />
                <span className="font-mono text-sm">{item.label}</span>
              </Link>
            );
          })}
          
          <div className="pt-8">
             <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-[10px]">🦙</div>
                   <span className="text-xs font-bold text-purple-400">Vic Says:</span>
                </div>
                <p className="text-xs text-gray-500 italic">
                   &ldquo;Leverage is just a number. Liquidation is a lifestyle.&rdquo;
                </p>
             </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800">
           {/* Placeholder for future pair list summary or footer */}
           <div className="text-xs text-gray-600 text-center font-mono">
              FakeDEX v1.0.0
           </div>
        </div>
      </aside>
    </>
  );
}

