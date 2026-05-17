import React from 'react';
import { Clock3 } from 'lucide-react';

const ComingSoonBadge: React.FC = () => (
  <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-300 px-3.5 py-2 text-label-sm font-black uppercase tracking-wider text-amber-950 shadow-lg shadow-amber-500/20 ring-2 ring-amber-200/35">
    <Clock3 className="h-4 w-4" />
    Coming Soon
  </span>
);

export default ComingSoonBadge;
