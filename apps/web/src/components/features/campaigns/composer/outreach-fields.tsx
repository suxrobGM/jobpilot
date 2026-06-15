"use client";

import { Stack, Typography } from "@mui/material";
import { useStore } from "@tanstack/react-form";
import { withForm } from "@/components/ui/form/tanstack";
import { COMPOSER_DEFAULT_VALUES, isBoardSelected } from "./form-config";

/** Outreach campaign fields: channels, LinkedIn tier, job cap, autonomy, resume handling. */
export const OutreachFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  render: function OutreachFields({ form }) {
    const channels = useStore(form.store, (s) => s.values.channels);
    const board = useStore(form.store, (s) => s.values.board);
    const autonomy = useStore(form.store, (s) => s.values.autonomy);

    return (
      <Stack spacing={2}>
        <form.AppField name="channels">
          {(field) => (
            <field.Toggle
              label="Channels"
              exclusive={false}
              options={[
                { value: "email", label: "Email" },
                { value: "linkedin", label: "LinkedIn" },
              ]}
            />
          )}
        </form.AppField>

        {channels.includes("linkedin") && (
          <form.AppField name="linkedinTier">
            {(field) => (
              <field.Toggle
                label="LinkedIn tier"
                options={[
                  { value: "free", label: "Free (connect → DM)" },
                  { value: "premium", label: "Premium (InMail)" },
                ]}
              />
            )}
          </form.AppField>
        )}

        {/* Cap only applies when sourcing from a board. Reuses the optional `maxApps`
            field (empty = unlimited) → mapped to config.maxJobs in buildCampaignConfig. */}
        {isBoardSelected(board) && (
          <form.AppField name="maxApps">
            {(field) => (
              <field.TextField
                label="Max jobs to source"
                type="number"
                helperText="Leave empty to run until you stop."
                slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="autonomy">
          {(field) => (
            <field.Toggle
              label="Autonomy"
              options={[
                { value: "draft", label: "Draft only" },
                { value: "review", label: "Review each" },
                { value: "auto", label: "Auto-send" },
              ]}
            />
          )}
        </form.AppField>

        {autonomy === "auto" && (
          <form.AppField name="dailyCap">
            {(field) => (
              <field.TextField
                label="Daily send cap"
                type="number"
                helperText="Auto-send applies to email only; LinkedIn stays human-approved."
                slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="resumeUrl">
          {(field) => (
            <field.TextField
              label="Resume URL (optional)"
              placeholder="https://example.com/resume.pdf"
              helperText="Paste your public resume URL — recipients will see a clickable link in the email. Leave blank to omit."
            />
          )}
        </form.AppField>
        <Typography variant="captionMuted">
          Cold-email attachments hurt deliverability — the tailored resume shapes the message and is
          best shared as a link.
        </Typography>
      </Stack>
    );
  },
});
