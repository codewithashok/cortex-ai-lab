import { Box, Chip, Stack, Typography } from "@mui/material";

export default function FeaturePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="h4">{title}</Typography>
        <Chip label="Not built yet" size="small" color="warning" />
      </Stack>
      <Typography color="text.secondary">{description}</Typography>
      <Box
        sx={{
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
          p: 4,
          color: "text.secondary",
        }}
      >
        This feature has not been implemented yet.
      </Box>
    </Stack>
  );
}
