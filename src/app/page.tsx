import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Heart,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Check,
  MoveUpRight,
  Leaf,
} from "lucide-react";
import { Brand, PiperMark } from "@/components/brand";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#the-difference">The Piper difference</a>
          <a href="#your-pace">Your privacy</a>
        </nav>
        <Button asChild size="sm" variant="outline">
          <Link href="/onboarding">
            Get started <ArrowUpRight size={15} />
          </Link>
        </Button>
      </header>
      <main id="main">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-star">✳</span> A MORE HUMAN WAY TO MEET
            </span>
            <h1>
              Stop swiping.
              <br />
              Start <em>connecting.</em>
            </h1>
            <p className="hero-description">
              Your AI finds the people.
              <br />
              You build the relationship.
            </p>
            <p className="hero-note">
              Meet Piper, your thoughtful little matchmaker. Real conversations,
              intentional introductions, and people who make sense for you.
            </p>
            <div className="hero-actions">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Get started <ArrowUpRight size={19} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/onboarding?demo=1">
                  Try interactive demo <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
            <div className="hero-footnote">
              <span className="mini-hearts">
                <Heart size={14} />
                <Heart size={14} />
                <Heart size={14} />
              </span>
              No endless feed. No account needed to explore.
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of a thoughtful introduction between fictional profiles"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✧</span>
            <div className="hero-profile hero-profile-back">
              <Portrait id="daniel" />
              <div className="hero-profile-caption">
                <strong>Jamie, 32</strong>
                <span>Big walks. Bigger conversations.</span>
              </div>
            </div>
            <div className="hero-profile hero-profile-front">
              <Portrait id="lena" />
              <div className="hero-profile-caption">
                <strong>
                  Lena, 30{" "}
                  <span className="check-circle">
                    <Check size={11} />
                  </span>
                </strong>
                <span>Curiosity looks good on you.</span>
              </div>
            </div>
            <div className="piper-note">
              <PiperMark />
              <div>
                <span>A LITTLE THOUGHT FROM PIPER</span>
                <p>
                  Both curious. Both intentional.
                  <br />
                  This could be a lovely beginning.
                </p>
              </div>
              <Heart size={19} />
            </div>
            <div className="floating-pill">
              <span className="status-dot" /> Shared values. Fresh
              possibilities.
            </div>
            <span className="illustration-label">
              FICTIONAL DEMO PROFILES · ILLUSTRATED
            </span>
          </div>
        </section>
        <div className="belief-strip">
          <span>Less searching, more living.</span>
          <span>
            <Sparkles size={18} /> Thoughtfully introduced
          </span>
          <span>
            <MessageCircle size={18} /> Conversation first
          </span>
          <span>
            <ShieldCheck size={18} /> Always your choice
          </span>
        </div>
        <section id="how-it-works" className="how-section section-wrap">
          <div className="section-heading">
            <span className="eyebrow">A DIFFERENT KIND OF FIRST MOVE</span>
            <h2>
              A little conversation.
              <br />A whole new <em>possibility.</em>
            </h2>
            <p>
              You are more than six photos and a clever prompt.
              <br />
              Let’s start with what actually matters to you.
            </p>
          </div>
          <div className="steps-grid">
            <article>
              <span className="step-number">01 /</span>
              <div className="step-illustration conversation-illustration">
                <span>What does your ideal Sunday feel like?</span>
                <span>A long walk. Someone to cook with.</span>
                <span>
                  That’s a lovely place to start. <Heart size={13} />
                </span>
              </div>
              <h3>Be yourself. We’re listening.</h3>
              <p>
                Tell Piper about your life, your values, and the kind of
                connection you’re looking for.
              </p>
            </article>
            <article>
              <span className="step-number">02 /</span>
              <div className="step-illustration affinity-illustration">
                <span>
                  <Leaf /> Your pace
                </span>
                <span>
                  <Heart /> Your values
                </span>
                <span>
                  <Sparkles /> Your kind of person
                </span>
              </div>
              <h3>Meet people with intention.</h3>
              <p>
                Discover a small, considered set of introductions that respect
                both people’s preferences.
              </p>
            </article>
            <article>
              <span className="step-number">03 /</span>
              <div className="step-illustration connection-illustration">
                <div>
                  <Portrait id="daniel" />
                </div>
                <span>
                  <Heart fill="currentColor" />
                </span>
                <div>
                  <Portrait id="lena" />
                </div>
              </div>
              <h3>Take it from here.</h3>
              <p>
                When the interest is mutual, a conversation opens. What happens
                next is beautifully human.
              </p>
            </article>
          </div>
        </section>
        <section
          id="the-difference"
          className="difference-section section-wrap"
        >
          <div>
            <span className="eyebrow">CURIOSITY, WITH CARE</span>
            <h2>
              Good introductions
              <br />
              ask better <em>questions.</em>
            </h2>
            <p>
              Shared interests are a beginning. But what about the things a
              profile hasn’t told you yet?
            </p>
            <p>
              Piper notices the gaps that matter, asks permission to explore
              them, and explains what changes. No guessing. No hidden
              compatibility promises.
            </p>
            <Button asChild variant="secondary">
              <Link href="/onboarding?demo=1">
                See an introduction unfold <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
          <div className="investigation-preview">
            <span className="badge sage">
              <Sparkles size={13} /> THE PIPER DIFFERENCE
            </span>
            <h3>
              One thoughtful question
              <br />
              can change the conversation.
            </h3>
            <div className="fact-row">
              <Check size={18} />
              <span>You’ve shared that you want children.</span>
            </div>
            <div className="fact-row">
              <MessageCircle size={18} />
              <span>Lena hasn’t shared her family plans yet.</span>
            </div>
            <div className="preview-question">
              “Would you feel comfortable sharing how you think about having
              children?”
            </div>
            <p>
              <ShieldCheck size={15} /> Asked with permission. Shared only with
              consent.
            </p>
            <small>Illustrative scenario with fictional people.</small>
          </div>
        </section>
        <section id="your-pace" className="privacy-section section-wrap">
          <ShieldCheck size={35} />
          <span className="eyebrow">YOUR STORY. YOUR SAY.</span>
          <h2>
            More connection.
            <br />
            <em>On your terms.</em>
          </h2>
          <div className="privacy-points">
            <p>
              <Check size={16} /> Review every detail before sharing
            </p>
            <p>
              <Check size={16} /> Skip any optional question
            </p>
            <p>
              <Check size={16} /> Keep your interview private
            </p>
            <p>
              <Check size={16} /> Edit, block, or leave at any time
            </p>
          </div>
          <Link className="text-link" href="/privacy">
            Our approach to privacy <MoveUpRight size={16} />
          </Link>
        </section>
        <section className="closing-section">
          <span className="tiny-star">✳</span>
          <h2>
            Your next chapter
            <br />
            starts with <em>hello.</em>
          </h2>
          <Button asChild size="lg">
            <Link href="/onboarding?demo=1">
              Say hello to Piper <ArrowUpRight size={19} />
            </Link>
          </Button>
          <p>A fictional, interactive demo. No sign-up required. Adults 18+.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Thoughtful technology. Human connection.</span>
        <div>
          <Link href="/privacy">Privacy & safety</Link>
          <Link href="/account">Your account</Link>
          <a
            href="https://github.com/akzholkarsybek/PiedPiper"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={12} />
          </a>
        </div>
        <small>
          © {new Date().getFullYear()} Pied Piper. Hackathon edition.
        </small>
      </footer>
    </>
  );
}
