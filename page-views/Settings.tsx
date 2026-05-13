"use client";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword } from "@/hooks/useAuth";

export function SettingsPage() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  const userEmail = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { email?: string }).email ?? null;
    } catch {
      return null;
    }
  }, []);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setDone(false);
    if (newPassword !== confirmPassword) {
      return;
    }
    await changePassword.mutateAsync({ currentPassword, newPassword });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
  }

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length > 0 &&
    !mismatch &&
    !changePassword.isPending;

  return (
    <PageWrapper
      title="Settings"
      description="Account security and preferences."
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            {userEmail ? (
              <>
                Signed in as <span className="font-medium text-foreground">{userEmail}</span>. Use your current password,
                then choose a new one (at least 6 characters).
              </>
            ) : (
              "Use your current password, then choose a new one (at least 6 characters)."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {mismatch ? <p className="text-sm text-destructive">New passwords do not match.</p> : null}
            {changePassword.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {changePassword.error instanceof Error ? changePassword.error.message : "Something went wrong"}
              </p>
            ) : null}
            {done ? (
              <p className="text-sm text-green-700 dark:text-green-400" role="status">
                Password updated. Use the new password next time you sign in on another device.
              </p>
            ) : null}
            <Button type="submit" disabled={!canSubmit}>
              {changePassword.isPending ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}