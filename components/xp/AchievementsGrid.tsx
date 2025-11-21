import { Achievement } from '@/hooks/useXP';
import { Lock, Award } from 'lucide-react';
import { clsx } from 'clsx';

interface AchievementsGridProps {
  achievements: Achievement[];
  earnedIds: Set<string>;
}

export function AchievementsGrid({ achievements, earnedIds }: AchievementsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {achievements.map((ach) => {
        const isEarned = earnedIds.has(ach.id);
        return (
          <div 
            key={ach.id}
            className={clsx(
              "relative p-4 rounded-xl border overflow-hidden group transition-all",
              isEarned 
                ? "bg-gray-900/80 border-yellow-500/30 hover:border-yellow-500/50" 
                : "bg-black/40 border-gray-800 opacity-60 grayscale"
            )}
          >
            {/* Shine effect for earned */}
            {isEarned && (
               <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}

            <div className="flex items-start justify-between mb-3">
               <div className={clsx(
                 "p-2 rounded-lg",
                 isEarned ? "bg-yellow-500/20 text-yellow-500" : "bg-gray-800 text-gray-500"
               )}>
                 {isEarned ? <Award className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
               </div>
               {ach.nsfw_flag && (
                 <span className="text-[10px] font-bold text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded">NSFW</span>
               )}
            </div>
            
            <h4 className="font-bold text-sm text-gray-200 mb-1">{ach.name}</h4>
            <p className="text-xs text-gray-500 leading-snug">{ach.description}</p>
            
            {isEarned && (
               <div className="mt-3 pt-3 border-t border-gray-800/50">
                  <span className="text-[10px] font-mono text-yellow-600 uppercase tracking-wider">Unlocked</span>
               </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

