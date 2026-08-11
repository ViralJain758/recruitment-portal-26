import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  Settings2,
  Camera,
  Lock,
  Clock,
  Share2,
  Cookie,
  UserCheck,
  RefreshCw,
  Mail,
  ShieldCheck,
  EyeOff,
} from "lucide-react";
import { ThemeToggle } from "../components/quiz/common/ThemeToggle";
import mlscLogo from "../assets/MLSC-logo.png";
import "./PrivacyPolicy.css";

const SUPPORT = { email: "msc@thapar.edu" };
const LAST_UPDATED = "August 8, 2026";

const SECTIONS = [
  {
    id: "collect",
    icon: Database,
    title: "Information We Collect",
    body: (
      <>
        <p>
          When you sign up and apply through this portal, we collect the
          information you provide directly, including:
        </p>
        <ul>
          <li>
            <strong>Account details</strong> — your name, email address, and
            password used to sign in.
          </li>
          <li>
            <strong>Application details</strong> — date of birth, phone
            number, college and enrollment information, department
            preferences, prior experience, and your responses to
            application questions.
          </li>
          <li>
            <strong>Test data</strong> — your answers, scores, timestamps,
            and submission status for the recruitment quiz.
          </li>
          <li>
            <strong>Attendance data</strong> — a scan record when your QR
            code is verified at the test venue, tied to your slot.
          </li>
          <li>
            <strong>Device and usage data</strong> — basic technical
            information such as browser type and session activity, used to
            keep your account secure and the exam session reliable.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    icon: Settings2,
    title: "How We Use Your Information",
    body: (
      <>
        <p>We use the information we collect only to:</p>
        <ul>
          <li>Create and manage your candidate account and application.</li>
          <li>
            Assign you a test slot and verify your attendance on test day.
          </li>
          <li>
            Administer the recruitment quiz and evaluate your submission.
          </li>
          <li>
            Communicate updates about your application status, schedule
            changes, or deadlines.
          </li>
          <li>Maintain the security and integrity of the recruitment process.</li>
        </ul>
        <p>
          We do not use your information for advertising, and we do not sell
          your data to any third party.
        </p>
      </>
    ),
  },
  {
    id: "proctoring",
    icon: Camera,
    title: "Exam Integrity & Proctoring",
    body: (
      <>
        <p>
          To keep the recruitment quiz fair for everyone, the exam interface
          may request camera and screen-sharing permissions before you
          begin, and shows a face-position indicator while the test is in
          progress.
        </p>
        <ul>
          <li>
            Face and gaze positioning is analyzed{" "}
            <strong>locally in your browser</strong> to show on-screen
            guidance if you look away for an extended period.
          </li>
          <li>
            We log tab-switch and focus warnings, along with your final
            answers, as part of the exam record, which is visible to the
            recruitment team.
          </li>
        </ul>
        <p>
          You will always be asked for explicit permission before camera or
          screen access is requested, and the quiz will not start without
          your consent.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    icon: Lock,
    title: "Data Storage & Security",
    body: (
      <p>
        Your data is stored on the servers used to operate this recruitment
        portal and is protected using industry-standard measures, including
        encrypted transmission (HTTPS), access-controlled admin accounts,
        and hashed password storage — we never store your password in
        plain text. Access to candidate data is limited to the recruitment
        team members who need it to run the selection process.
      </p>
    ),
  },
  {
    id: "retention",
    icon: Clock,
    title: "Data Retention",
    body: (
      <p>
        We retain your application and test data for as long as needed to
        complete the current recruitment cycle, and to maintain records of
        past cycles for internal reference. If you would like your data
        removed sooner, you can reach out using the contact details below.
      </p>
    ),
  },
  {
    id: "sharing",
    icon: Share2,
    title: "Sharing of Information",
    body: (
      <>
        <p>
          We do not sell, rent, or trade your personal information. Your
          data is only shared with:
        </p>
        <ul>
          <li>Recruitment team members reviewing applications and results.</li>
          <li>
            Service providers strictly necessary to run the portal (for
            example, hosting infrastructure), who are not permitted to use
            your data for any other purpose.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    icon: Cookie,
    title: "Cookies & Local Storage",
    body: (
      <p>
        This portal uses browser local storage to keep you signed in and to
        remember your theme preference (light or dark mode). These are
        functional only — we do not use tracking or advertising cookies.
      </p>
    ),
  },
  {
    id: "rights",
    icon: UserCheck,
    title: "Your Rights & Choices",
    body: (
      <>
        <p>You can, at any point before the registration deadline:</p>
        <ul>
          <li>
            Review and edit your application details from your dashboard.
          </li>
          <li>
            Request a copy of the data we hold about you, or ask us to
            correct or delete it, by contacting us below.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "changes",
    icon: RefreshCw,
    title: "Changes to This Policy",
    body: (
      <p>
        We may update this policy from time to time to reflect changes in
        the recruitment process. The "last updated" date at the top of this
        page will always reflect the most recent revision.
      </p>
    ),
  },
  {
    id: "contact",
    icon: Mail,
    title: "Contact Us",
    body: (
      <>
        <p>
          If you have any questions about this policy, or want to access,
          correct, or delete your data, reach out to us.
        </p>
        <a href={`mailto:${SUPPORT.email}`} className="pp-contact-btn">
          <Mail size={15} strokeWidth={2} />
          {SUPPORT.email}
        </a>
      </>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: ShieldCheck, text: "We only collect what's needed to run the recruitment process." },
  { icon: EyeOff, text: "Camera and screen access is only used for exam-integrity checks." },
  { icon: Share2, text: "Your data is never sold or shared outside the team." },
  { icon: UserCheck, text: "You can review, edit, or delete your data anytime." },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const sectionRefs = useRef({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      if (isAtBottom) {
        setActiveId(SECTIONS[SECTIONS.length - 1].id);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const isAtBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 60;

        if (isAtBottom) {
          setActiveId(SECTIONS[SECTIONS.length - 1].id);
          return;
        }

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-15% 0px -50% 0px", threshold: 0 },
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <main className="pp">
      <div className="pp-topbar">
        <button
          type="button"
          className="pp-back"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back to Dashboard
        </button>
        <ThemeToggle />
      </div>

      <header className="pp-hero">
        <img src={mlscLogo} alt="MLSC Logo" className="pp-hero-logo" />
        <div>
          <h1>Privacy Policy</h1>
          <p className="pp-hero-meta">
            MLSC Recruitment Portal &nbsp;·&nbsp; Last updated {LAST_UPDATED}
          </p>
        </div>
      </header>

      <p className="pp-lead">
        This policy explains what information the MLSC Recruitment portal
        collects during the application and selection process, and how it
        is used, stored, and protected. By using this portal to apply, you
        agree to the practices described below.
      </p>

      <div className="pp-highlights">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <div className="pp-highlight" key={text}>
            <Icon size={17} strokeWidth={2} />
            <span>{text}</span>
          </div>
        ))}
      </div>

      <div className="pp-shell">
        <nav className="pp-toc" aria-label="Policy sections">
          <span className="pp-toc-label">On this page</span>
          {SECTIONS.map((section, index) => {
            const Icon = section.icon;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setActiveId(section.id)}
                className={`pp-toc-link${
                  activeId === section.id ? " active" : ""
                }`}
              >
                <Icon size={15} strokeWidth={2} />
                <span>{section.title}</span>
                <span className="pp-toc-num">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </a>
            );
          })}
        </nav>

        <article className="pp-doc">
          {SECTIONS.map((section, index) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                ref={(el) => (sectionRefs.current[section.id] = el)}
                className="pp-section"
              >
                <h2>
                  <span className="pp-icon">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="pp-title-text">
                    <span className="pp-title-num">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </span>
                </h2>
                {section.body}
              </section>
            );
          })}
        </article>
      </div>
    </main>
  );
}
