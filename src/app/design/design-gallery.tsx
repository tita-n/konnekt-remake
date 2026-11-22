"use client";

import { useState } from "react";
import { ArrowRight, Heart, Info, Search } from "lucide-react";
import { Avatar, Card, CardHeader, CountPill, Skeleton, SkeletonText } from "@/components/ui/display";
import { Button, ButtonLink, IconButton, buttonStyles } from "@/components/ui/button";
import {
  CheckPill,
  Checkbox,
  Chip,
  PasswordField,
  PasswordStrengthMeter,
  Switch,
  TextField,
} from "@/components/ui/form-controls";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Tabs, SegmentedControl, Stepper } from "@/components/ui/navigation";
import { BottomSheet, Dialog } from "@/components/ui/overlays";
import { CodeInput } from "@/components/ui/code-input";
import { ImageCropper } from "@/components/ui/image-cropper";
import { useToast } from "@/components/providers/toast-provider";
import { CommunityBadge, CommunityCard, CommunityIcon, CommunityTile } from "@/components/communities/community-card";
import type { CommunityCardView } from "@/lib/communities/types";

const GALLERY_COMMUNITY: CommunityCardView = {
  id: "gallery-community",
  name: "Software Engineering Hub",
  slug: "software-engineering-hub",
  description: "Projects, past questions and lab tips for every level.",
  category: "ACADEMIC",
  privacy: "PUBLIC",
  status: "ACTIVE",
  isOfficial: true,
  iconUrl: null,
  bannerUrl: null,
  memberCount: 842,
  postCount: 196,
  recentActivity: "Aisha shared CSC 204 past questions",
  viewer: {
    joinState: "JOINED",
    isMember: true,
    role: "MEMBER",
    pendingRequest: false,
    hasInvite: false,
    muted: false,
    canModerate: false,
    canManage: false,
  },
};

export function DesignGallery({ theme }: { theme: "light" | "dark" }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [code, setCode] = useState("1234");
  const [segment, setSegment] = useState<"everyone" | "university" | "nobody">("university");
  const [password, setPassword] = useState("");
  const [chipSelected, setChipSelected] = useState(true);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const { toast } = useToast();

  return (
    <div data-theme={theme} className="min-h-dvh bg-bg px-4 py-6 text-fg">
      <div className="mx-auto max-w-3xl space-y-8">
        <section>
          <h2 className="mb-3 text-h2">Buttons</h2>
          <div className="space-y-3 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="create">Create</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button loading loadingLabel="Saving…">Save</Button>
              <Button disabled>Disabled</Button>
              <Button size="sm">Small</Button>
              <Button size="lg" rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}>
                Large
              </Button>
              <ButtonLink href="/design" variant="secondary" size="sm">
                Link button
              </ButtonLink>
              <IconButton label="Search"><Search aria-hidden="true" className="size-5" /></IconButton>
            </div>
            <Button fullWidth leftIcon={<Heart aria-hidden="true" className="size-4" />}>Full width</Button>
            <button type="button" className={buttonStyles({ variant: "ghost", size: "sm" })}>buttonStyles helper</button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h2">Fields</h2>
          <div className="space-y-4 rounded-card border border-border bg-surface p-4">
            <TextField label="Full name" placeholder="Chidera Okafor" required hint="As it appears on your student ID." />
            <TextField label="Email" type="email" placeholder="you@student.unilag.edu.ng" error="That email is already registered." />
            <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordStrengthMeter password={password} />
            <Checkbox label="I agree to the Terms and Privacy Policy" description="We store the version and time you accepted." checked readOnly />
            <Checkbox label="Unchecked with error" error="You must accept to continue." />
            <Switch checked={chipSelected} onCheckedChange={setChipSelected} label="Data saver" description="Reduces images and turns off glass effects." />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h2">Chips, avatars, cards</h2>
          <div className="space-y-4 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap gap-2">
              <Chip selected={chipSelected} onClick={() => setChipSelected((v) => !v)}>Selected chip</Chip>
              <Chip>Unselected</Chip>
              <Chip icon={<Info aria-hidden="true" className="size-3.5" />}>With icon</Chip>
              <CountPill count={12} label="Notifications" />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Avatar name="Chidera Okafor" size="xs" verified />
              <Avatar name="Chidera Okafor" size="sm" verified />
              <Avatar name="Femi Adeyemi" size="md" official />
              <Avatar name="Ifeoma Nwosu" size="lg" />
              <Avatar name="Nnamdi Eze" size="xl" verified />
            </div>
            <div className="flex flex-wrap gap-2">
              <CheckPill checked>Format valid</CheckPill>
              <CheckPill checked={false}>Duplicate?</CheckPill>
            </div>
            <Card>
              <CardHeader title="Card title" description="Supporting line" action={<Button size="sm" variant="secondary">Action</Button>} />
              <div className="p-4 text-small text-fg-muted">Card body content.</div>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h2">Navigation & feedback</h2>
          <div className="space-y-4 rounded-card border border-border bg-surface p-4">
            <Tabs label="Example tabs" current="/pulse" items={[{ label: "All", href: "/pulse" }, { label: "Department", href: "/pulse/department" }, { label: "Level", href: "/pulse/level" }]} />
            <Stepper steps={["Profile", "Interests"]} current={0} />
            <SegmentedControl
              label="Who can see your department"
              value={segment}
              onChange={setSegment}
              options={[
                { value: "everyone", label: "Everyone" },
                { value: "university", label: "University" },
                { value: "nobody", label: "Nobody" },
              ]}
            />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" rounded="rounded-card" />
              <SkeletonText lines={2} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
              <Button variant="secondary" onClick={() => toast({ title: "Saved", description: "Your changes are live.", variant: "success" })}>
                Show toast
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-border bg-surface">
              <EmptyState illustration="pulse" title="Nothing on the Pulse yet" description="Posts arrive with the next release." compact />
            </div>
            <div className="rounded-card border border-border bg-surface">
              <ErrorState description="This is the error pattern." onRetry={() => undefined} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h2">Communities</h2>
          <div className="space-y-4 rounded-card border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <CommunityIcon community={GALLERY_COMMUNITY} size="lg" />
              <CommunityBadge official privacy="PUBLIC" />
              <CommunityBadge official={false} privacy="REQUEST" />
            </div>
            <div className="max-w-sm">
              <CommunityCard community={GALLERY_COMMUNITY} />
            </div>
            <div className="max-w-[220px]">
              <CommunityTile community={GALLERY_COMMUNITY} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h2">Code input & cropper</h2>
          <div className="space-y-4 rounded-card border border-border bg-surface p-4">
            <CodeInput value={code} onChange={setCode} hint="6-digit code, paste supported." />
            <div>
              <label htmlFor="crop-demo" className="mb-2 block text-small font-semibold">Pick a photo to test the cropper</label>
              <input
                id="crop-demo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setCropFile(event.target.files?.[0] ?? null)}
                className="block w-full text-small text-fg-muted file:mr-3 file:rounded-button file:border-0 file:bg-accent file:px-3 file:py-2 file:text-small file:font-semibold file:text-accent-fg"
              />
              {cropFile ? (
                <div className="mt-4">
                  <ImageCropper
                    file={cropFile}
                    saving={false}
                    onCancel={() => setCropFile(null)}
                    onSave={() => {
                      toast({ title: "Crop generated", description: "A 1024×1024 JPEG was produced.", variant: "success" });
                      setCropFile(null);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Suspend this student?"
        description="They will not be able to sign in until you reinstate them. This is recorded in the audit log."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setDialogOpen(false)}>Suspend student</Button>
          </>
        }
      />
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Bottom sheet" description="Frosted glass, or solid when the device or preferences require it.">
        <p className="pb-6 text-small text-fg-muted">
          This surface uses the same glass token as the top bar and tab bar. It becomes solid automatically with reduced
          transparency, Data saver, low device memory or unsupported backdrop filters.
        </p>
      </BottomSheet>
    </div>
  );
}
