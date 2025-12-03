'use client';

import { User } from '@/lib/types';
import { shortenAddress } from '@/lib/utils';
import { Copy, ExternalLink, Settings, Share2, Trophy, Verified } from 'lucide-react';
import { useState } from 'react';

interface ProfileHeaderProps {
  profile: User;
  isOwnProfile?: boolean;
  followersCount?: number;
  followingCount?: number;
  rank?: number;
}

// Fun titles based on level
function getLevelTitle(level: number): { title: string; color: string } {
  if (level >= 50) return { title: 'Legendary Degen', color: 'text-yellow-400' };
  if (level >= 30) return { title: 'Diamond Hands', color: 'text-cyan-400' };
  if (level >= 20) return { title: 'Ape Commander', color: 'text-purple-400' };
  if (level >= 10) return { title: 'Certified Degen', color: 'text-green-400' };
  if (level >= 5) return { title: 'Aspiring Ape', color: 'text-blue-400' };
  return { title: 'Fresh Meat', color: 'text-gray-400' };
}

// Generate avatar gradient based on wallet
function getAvatarGradient(address: string): string {
  const gradients = [
    'from-purple-600 to-pink-600',
    'from-blue-600 to-cyan-600',
    'from-green-600 to-emerald-600',
    'from-orange-600 to-red-600',
    'from-indigo-600 to-purple-600',
    'from-pink-600 to-rose-600',
  ];
  const index = address.charCodeAt(2) % gradients.length;
  return gradients[index];
}

export function ProfileHeader({ 
  profile, 
  isOwnProfile = false,
  followersCount = Math.floor(Math.random() * 500),
  followingCount = Math.floor(Math.random() * 200),
  rank = Math.floor(Math.random() * 1000) + 1,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const levelInfo = getLevelTitle(profile.level);
  const gradient = getAvatarGradient(profile.wallet_address);

  const copyAddress = () => {
    navigator.clipboard.writeText(profile.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Background Banner */}
      <div className="h-32 md:h-40 bg-gradient-to-r from-purple-900/50 via-pink-900/30 to-blue-900/50 rounded-t-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMzMzMzIwIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        
        {/* Rank Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-mono text-white">#{rank}</span>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="relative -mt-16 mb-4 flex items-end justify-between">
          <div className={`w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl font-bold shadow-2xl border-4 border-gray-900`}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              profile.username?.slice(0, 2).toUpperCase() || '??'
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-2">
            {isOwnProfile ? (
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <button className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors font-bold text-sm">
                Follow
              </button>
            )}
            <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Name & Title */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {profile.username || 'Anonymous'}
            </h1>
            {profile.level >= 10 && (
              <Verified className="w-5 h-5 text-purple-500" />
            )}
          </div>
          <span className={`text-sm font-mono ${levelInfo.color} bg-gray-800/50 px-2 py-0.5 rounded w-fit`}>
            {levelInfo.title}
          </span>
        </div>

        {/* Wallet Address */}
        <button
          onClick={copyAddress}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group"
        >
          <span className="font-mono text-sm">
            {shortenAddress(profile.wallet_address, 6)}
          </span>
          {copied ? (
            <span className="text-xs text-green-500">Copied!</span>
          ) : (
            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>

        {/* Stats Row */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">{followersCount}</span>
            <span className="text-gray-500">followers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">{followingCount}</span>
            <span className="text-gray-500">following</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-yellow-500">Lvl {profile.level}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{profile.xp.toLocaleString()} XP</span>
          </div>
        </div>

        {/* Join Date */}
        <div className="mt-3 text-xs text-gray-600">
          Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
