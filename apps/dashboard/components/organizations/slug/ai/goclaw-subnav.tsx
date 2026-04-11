'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { replaceOrgSlug, routes } from '@workspace/routes';
import { cn } from '@workspace/ui/lib/utils';

const items = [
  { title: 'Overview', route: routes.dashboard.organizations.slug.ai.Index },
  { title: 'Agents', route: routes.dashboard.organizations.slug.ai.Agents },
  { title: 'Providers', route: routes.dashboard.organizations.slug.ai.Providers },
  { title: 'Channels', route: routes.dashboard.organizations.slug.ai.Channels },
  { title: 'Teams', route: routes.dashboard.organizations.slug.ai.Teams }
] as const;

export type GoclawSubnavProps = {
  slug: string;
};

export function GoclawSubnav({ slug }: GoclawSubnavProps): React.JSX.Element {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b pb-2">
      {items.map((item) => {
        const href = replaceOrgSlug(item.route, slug);
        const active = pathname === href;
        return (
          <Link
            key={item.route}
            href={href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
