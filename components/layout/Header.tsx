'use client';

import Link from 'next/link';
import { ConnectButton } from "thirdweb/react";
import { client, sepoliaChain } from "@/lib/thirdwebClient";
import { Menu, User } from 'lucide-react';

export function Header({ toggleSidebar }: { toggleSidebar?: () => void }) {
  return (
    <header className="h-16 border-b border-gray-800 bg-black/50 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        {toggleSidebar && (
          <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-gray-800 rounded-md">
            <Menu className="w-6 h-6 text-gray-400" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center overflow-hidden border border-gray-600">
             {/* Vic Avatar Placeholder */}
             <span className="text-xs font-bold">VIC</span>
          </div>
          <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent hidden sm:block">
            FakeDEX
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-900/50 rounded-full border border-gray-800">
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
           <span className="text-xs text-gray-400 font-mono">SYSTEM ONLINE</span>
        </div>

        <Link
          href="/profile/me"
          className="hidden md:flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-wide bg-gray-900/70 border border-gray-800 rounded-full hover:border-green-500 transition-colors"
        >
          <User className="w-3 h-3" />
          Profile
        </Link>
        
        <ConnectButton client={client} chain={sepoliaChain} theme="dark" />
      </div>
    </header>
  );
}
