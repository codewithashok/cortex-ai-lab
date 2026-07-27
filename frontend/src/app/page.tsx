"use client";

import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { navItems } from "@/lib/nav-items";

export default function DashboardPage() {
  const features = navItems.filter((item) => item.href !== "/");

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">
          Enterprise AI capabilities, built one feature at a time.
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <Grid key={feature.href} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined">
                <CardActionArea component={Link} href={feature.href}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                      <Icon color="primary" />
                      <Typography variant="h6">{feature.label}</Typography>
                    </Stack>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                      {feature.description}
                    </Typography>
                    <Chip label="Not built yet" size="small" color="warning" />
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
