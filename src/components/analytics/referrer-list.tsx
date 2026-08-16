"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReferrerEntry {
  referrer: string;
  count: number;
}

interface ReferrerListProps {
  data: ReferrerEntry[];
}

export function ReferrerList({ data }: ReferrerListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fuentes de Trafico</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin referrers externos</p>
        ) : (
          <div className="space-y-2">
            {data.map((entry) => (
              <div
                key={entry.referrer}
                className="flex min-w-0 items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{entry.referrer}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums whitespace-nowrap">
                  {entry.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
