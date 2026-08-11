"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { updateMyProfile, uploadAvatar } from "@/lib/api/profile";
import { downscaleImage, imageRejection, releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

/**
 * Editing your own profile, in place on `/profile` — a port of the top of
 * `tho/app/lib/customer/profile_screen.dart`: the avatar with Add/Change photo, the
 * name field, and Save.
 *
 * **The avatar saves on pick; name and phone save on Save.** That split is the app's
 * (`_pickAvatar` writes immediately, `_saveName` waits for the button) and it is right
 * for a different reason here: a picked photo is already a deliberate act with a file
 * dialog behind it, whereas a half-typed name is not, and a browser tab can be closed
 * mid-word in a way an app screen cannot.
 *
 * **Phone is here and is not in the app.** It is the SMS destination the notification
 * worker looks for (`p.phone` in the outbox claim query), and every queued
 * notification currently fails with "no deliverable channel". Saving a number makes a
 * future delivery possible — the label says exactly that and no more, because there is
 * no gateway yet and nothing here may promise a message.
 */
export function ProfileEditor({
  initial,
  email,
}: {
  initial: { fullName: string | null; phone: string | null; avatarUrl: string | null };
  email: string | null;
}) {
  const [name, setName] = useState(initial.fullName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /** The object URL of a picked photo still on screen, so unmount can release it. */
  const preview = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );

  const dirty =
    name.trim() !== (initial.fullName ?? "").trim() ||
    phone.trim() !== (initial.phone ?? "").trim();

  async function pickAvatar(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const rejection = imageRejection(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }

    setUploading(true);
    const picked = await downscaleImage(file);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      // The old URL goes in so its object is removed: each upload takes a fresh path
      // rather than upserting, so without this every photo change would leave a file
      // behind. See `uploadAvatar` for why it is a fresh path and not an upsert.
      const url = await uploadAvatar(supabase, user.id, picked.blob, picked.mime, avatarUrl);
      await updateMyProfile(supabase, user.id, { avatarUrl: url });

      // Show the uploaded URL, not the local preview: if the write succeeded but the
      // object is somehow unreadable, the monogram fallback is the honest answer.
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = null;
      releasePreview(picked);
      setAvatarUrl(url);
      toast.success("Photo updated.");
    } catch {
      releasePreview(picked);
      toast.error("Couldn't upload that photo.");
    } finally {
      setUploading(false);
      // Let the same file be chosen again after a failure.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      await updateMyProfile(supabase, user.id, {
        // Empty means cleared, not unchanged — `null` is what the column holds for
        // someone who has never set one, and sending "" would store a blank string
        // that reads as a phone number to the outbox query.
        fullName: name.trim() === "" ? null : name.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
      });
      toast.success("Saved.");
    } catch {
      toast.error("Couldn't save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-hairline-soft p-base rounded-md border">
      <div className="gap-base flex items-center">
        <Avatar name={name || email || "You"} photoUrl={avatarUrl} size={72} />
        <div className="min-w-0">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickAvatar(e.target.files)}
          />
          <Button
            variant="quiet"
            busy={uploading}
            onClick={() => fileInput.current?.click()}
            className="px-0"
          >
            <Icons.camera
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            {avatarUrl ? "Change photo" : "Add photo"}
          </Button>
          <p className="text-caption-sm text-muted">JPEG, PNG or WebP, up to 8 MB.</p>
        </div>
      </div>

      <div className="mt-lg gap-base flex flex-col">
        <Field
          id="profile-name"
          label="Full name"
          value={name}
          onChange={setName}
          placeholder="Your name"
          autoComplete="name"
        />
        <Field
          id="profile-phone"
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="+975 17 000 000"
          type="tel"
          autoComplete="tel"
          hint="Salons use this to reach you about a booking. Text-message alerts aren't switched on yet."
        />
      </div>

      <div className="mt-lg">
        {/* Disabled until something changed, so the button is never a no-op write —
            `updated_at` moving for nothing would be visible to the salon's client list. */}
        <Button busy={saving} disabled={!dirty} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="text-caption text-muted block font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={hintId}
        className="border-hairline text-body-md text-ink placeholder:text-muted-soft focus:border-rausch mt-xxs px-md min-h-12 w-full rounded-sm border bg-transparent outline-none"
      />
      {hint ? (
        <p id={hintId} className="text-caption-sm text-muted mt-xxs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
