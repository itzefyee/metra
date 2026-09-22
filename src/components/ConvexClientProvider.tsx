'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useMemo } from 'react';
import { getConvexUrl } from '@convex-dev/static-hosting';

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useMemo(
    () => {
      // Local development uses the URL written by `npx convex dev`. Once the
      // static bundle is served from `<deployment>.convex.site`, derive the
      // matching realtime/API origin without baking a deployment name into it.
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || getConvexUrl();
      return new ConvexReactClient(convexUrl);
    },
    []
  );

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
