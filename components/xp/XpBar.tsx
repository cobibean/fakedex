import { UserProfile } from '@/hooks/useXP';

export function XpBar({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;

  const nextLevelXp = profile.level * 100; // Linear curve for V1
  const progress = Math.min(100, (profile.xp / nextLevelXp) * 100);

  return (
    <div className="glass-panel rounded-xl p-4 border border-gray-800">
       <div className="flex justify-between items-end mb-2">
           <div>
               <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Current Rank</div>
               <div className="text-xl font-bold text-yellow-500 flex items-baseline gap-1">
                   Level {profile.level}
                   <span className="text-xs text-gray-600 font-normal">({profile.xp} / {nextLevelXp} XP)</span>
               </div>
           </div>
           <div className="text-right">
               <div className="text-xs text-gray-400 font-mono">
                   {profile.username || 'Anon Degen'}
               </div>
           </div>
       </div>
       
       <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800 relative">
           {/* Background stripes */}
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', backgroundSize: '10px 10px' }}></div>
           
           {/* Progress Fill */}
           <div 
               className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 relative transition-all duration-1000 ease-out"
               style={{ width: `${progress}%` }}
           >
               <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
           </div>
       </div>
    </div>
  );
}

