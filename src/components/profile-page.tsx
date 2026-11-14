"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Check,
  ArrowUpRight,
  MapPin,
  Heart,
  CirclePause,
} from "lucide-react";
import { Portrait } from "./portrait";
import { title } from "@/lib/profile";
import Link from "next/link";
import { AppShell, NoProfile } from "./app-shell";
import { ProfileEditor } from "./profile-editor";
import { InstagramField } from "./instagram-field";
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
          <section
            className="pf-hero"
            aria-label="Your profile as matches see it"
          >
            <div className="pf-hero-photo">
              <Portrait
                id={state.profile.name.trim().toLowerCase() || "guest"}
                gender={state.profile.gender}
                age={state.profile.age}
                label="Illustrated placeholder avatar for your fictional demo profile"
              />
            </div>
            <div className="pf-hero-body">
              <div className="pf-hero-top">
                <h2>
                  {state.profile.name || "Your name"}
                  {state.profile.age ? `, ${state.profile.age}` : ""}
                </h2>
                {state.profile.approved ? (
                  <span className="status-chip is-confirmed">
                    <Check size={12} /> Approved by you
                  </span>
                ) : (
                  <span className="status-chip is-suggested">
                    Awaiting your approval
                  </span>
                )}
                {state.profile.readyToConnect === false && (
                  <span className="status-chip is-unknown">
                    <CirclePause size={12} /> Paused
                  </span>
                )}
              </div>
              <ul className="dc-meta">
                {state.profile.city && (
                  <li>
                    <MapPin size={15} /> {state.profile.city}
                  </li>
                )}
                {state.profile.intent && (
                  <li>
                    <Heart size={15} /> {title(state.profile.intent)}
                  </li>
                )}
              </ul>
              {state.profile.bio && (
                <p className="pf-hero-bio">{state.profile.bio}</p>
              )}
              <div className="tag-row dc-tags">
                {state.profile.interests.map((t) => (
                  <span key={t} className="shared">
                    {title(t)}
                  </span>
                ))}
                {state.profile.values.map((v) => (
                  <span key={v}>{title(v)}</span>
                ))}
              </div>
            </div>
          </section>
          <div className="pf-layout">
            <nav className="pf-nav" aria-label="Profile sections">
              <a href="#essentials">The essentials</a>
              <a href="#about-you">Interests & lifestyle</a>
              <a href="#preferences">Partner preferences</a>
              <a href="#instagram">Instagram (optional)</a>
              <a href="#your-data">Your data</a>
              <span className="pf-nav-divider" />
              <Link href="/matchmaker#availability">
                Availability <ArrowUpRight size={13} />
              </Link>
              <Link href="/matchmaker#enrichment">
                Interest suggestions <ArrowUpRight size={13} />
              </Link>
            </nav>
            <div className="pf-content">
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
              <div id="instagram" className="pf-anchor">
                <InstagramField
                  value={state.social.instagram}
                  onSave={(instagram) =>
                    dispatchDemo({ type: "social", instagram })
                  }
                />
              </div>
              <section className="data-controls" id="your-data">
                <div>
                  <h3>Your data, your choice.</h3>
                  <p>
                    Delete this demo profile, messages, feedback, and decisions
                    from this browser. {state.profile.blockedIds.length}{" "}
                    profile(s) blocked.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setDeleting(true)}>
                  <Trash2 size={16} />
                  Delete demo data
                </Button>
              </section>
            </div>
          </div>
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
