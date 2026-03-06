"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DeviceEntry {
  device_type: string;
  count: number;
}

interface DeviceBreakdownProps {
  data: DeviceEntry[];
}

const deviceLabels: Record<string, string> = {
  desktop: "Escritorio",
  mobile: "Movil",
  tablet: "Tablet",
};

export function DeviceBreakdown({ data }: DeviceBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dispositivos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos</p>
        ) : (
          data.map((entry) => {
            const pct = Math.round((entry.count / total) * 100);
            return (
              <div key={entry.device_type} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{deviceLabels[entry.device_type] || entry.device_type}</span>
                  <span className="text-muted-foreground">
                    {pct}% ({entry.count})
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
