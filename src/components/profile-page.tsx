"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AppShell, NoProfile } from "./app-shell";
import { ProfileEditor } from "./profile-editor";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import { deleteDemo, dispatchDemo, useDemo } from "@/lib/demo-store";
export function ProfilePage() {
  const state = useDemo(),
    router = useRouter(),
    [deleting, setDeleting] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <AppShell>
      {!state.profile ? (
        <NoProfile />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR STORY. YOUR SAY.</span>
              <h1>
                A little more <em>you.</em>
              </h1>
              <p>Your approved, fictional profile. Always yours to change.</p>
            </div>
          </div>
          {saved && (
            <div className="notice success-notice" role="status">
              <Check size={18} />
              Profile saved. Introductions now reflect your updated preferences.
              <Link href="/discover" className="text-link">
                See introductions <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <div className="profile-page-panel">
            <ProfileEditor
              profile={state.profile}
              saveLabel="Save & update introductions"
              onSave={(p) => {
                dispatchDemo({ type: "profile", profile: p });
                setSaved(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
          <section className="data-controls">
            <div>
              <h3>Your data, your choice.</h3>
              <p>
                Delete this demo profile, messages, feedback, and decisions from
                this browser. {state.profile.blockedIds.length} profile(s)
                blocked.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 size={16} />
              Delete demo data
            </Button>
          </section>
          {deleting && (
            <Modal
              title="Start with a clean slate?"
              onClose={() => setDeleting(false)}
            >
              <p>
                This deletes all Pied Piper demo data saved in this browser,
                including your profile and messages.
              </p>
              <div className="inline-actions">
                <Button variant="outline" onClick={() => setDeleting(false)}>
                  Keep my data
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteDemo();
                    router.push("/");
                  }}
                >
                  Delete all demo data
                </Button>
              </div>
            </Modal>
          )}
        </>
      )}
    </AppShell>
  );
}
