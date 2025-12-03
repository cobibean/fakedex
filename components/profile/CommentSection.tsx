'use client';

import { useState } from 'react';
import { Comment } from '@/lib/types';
import { formatDistanceToNow, shortenAddress } from '@/lib/utils';
import { Send, MessageCircle, Flame, Skull, Heart, Laugh } from 'lucide-react';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment?: (content: string) => Promise<void>;
  isOwnProfile?: boolean;
  canComment?: boolean;
}

// Reaction emojis for comments
const REACTIONS = [
  { icon: <Flame className="w-3 h-3" />, label: '🔥', count: () => Math.floor(Math.random() * 12) },
  { icon: <Skull className="w-3 h-3" />, label: '💀', count: () => Math.floor(Math.random() * 8) },
  { icon: <Heart className="w-3 h-3" />, label: '❤️', count: () => Math.floor(Math.random() * 5) },
  { icon: <Laugh className="w-3 h-3" />, label: '😂', count: () => Math.floor(Math.random() * 15) },
];

// Fun placeholder comments for demo
const PLACEHOLDER_COMMENTS: Comment[] = [
  {
    id: '1',
    user_id: 'bot1',
    profile_id: 'profile',
    content: 'bro really went 100x on $SHIT and survived 💀',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    user: { username: 'CryptoChad69', wallet_address: '0x1234...abcd', level: 12 },
  },
  {
    id: '2',
    user_id: 'bot2',
    profile_id: 'profile',
    content: 'teach me your ways ser 🙏',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    user: { username: 'DegenKing', wallet_address: '0x5678...efgh', level: 8 },
  },
  {
    id: '3',
    user_id: 'bot3',
    profile_id: 'profile',
    content: 'absolute legend. wagmi 🚀',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    user: { username: 'MoonBoi', wallet_address: '0x9abc...ijkl', level: 5 },
  },
];

export function CommentSection({ 
  comments: propComments, 
  onAddComment, 
  isOwnProfile = false,
  canComment = true 
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use placeholder comments if none provided
  const comments = propComments.length > 0 ? propComments : PLACEHOLDER_COMMENTS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !onAddComment) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      {canComment && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={isOwnProfile ? "Post an update..." : "Leave a comment..."}
            className="flex-1 bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
            maxLength={280}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-mono text-sm">No comments yet. Be the first degen to say something.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="glass-panel rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-all group"
            >
              {/* Comment Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold">
                  {comment.user?.username?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">
                      {comment.user?.username || shortenAddress(comment.user?.wallet_address || '')}
                    </span>
                    <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                      Lvl {comment.user?.level || 1}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(comment.created_at)}
                  </span>
                </div>
              </div>

              {/* Comment Content */}
              <p className="text-gray-300 font-mono text-sm pl-10">
                {comment.content}
              </p>

              {/* Reactions */}
              <div className="flex items-center gap-3 mt-3 pl-10">
                {REACTIONS.map((reaction, idx) => {
                  const count = reaction.count();
                  if (count === 0) return null;
                  return (
                    <button
                      key={idx}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      <span>{reaction.label}</span>
                      <span className="font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
