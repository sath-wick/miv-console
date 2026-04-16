import { Link } from "react-router-dom";
import { NAV_ITEMS } from "@/constants/app";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/cn";

const MODULE_META: Record<string, { icon: string }> = {
  "/menu": { icon: "menu" },
  "/billing": { icon: "billing" },
  "/payments": { icon: "payments" },
  "/subscriptions": { icon: "subscriptions" },
  "/customers": { icon: "customers" },
  "/history": { icon: "history" },
  "/command-center": { icon: "command" },
  "/kitchen-board": { icon: "kitchen" },
  "/courier": { icon: "courier" },
  "/inventory": { icon: "inventory" }
};

function ModuleIcon({ type }: { type: string }) {
  switch (type) {
    case "menu":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <path strokeLinecap="round" d="M5 7h14M5 12h14M5 17h10" />
        </svg>
      );
    case "billing":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
          <path strokeLinecap="round" d="M8 10.5h8M8 14h5" />
        </svg>
      );
    case "customers":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <circle cx="12" cy="8" r="3" />
          <path strokeLinecap="round" d="M6.5 18c1.2-2.5 3-4 5.5-4s4.3 1.5 5.5 4" />
        </svg>
      );
    case "history":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
          <path strokeLinecap="round" d="M21 12A9 9 0 1 1 8.7 3.5" />
        </svg>
      );
    case "kitchen":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <path strokeLinecap="round" d="M5 12h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12a5 5 0 0 1 10 0v3H7v-3Z" />
        </svg>
      );
    case "courier":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" />
          <circle cx="7" cy="18" r="1.5" />
          <circle cx="17" cy="18" r="1.5" />
        </svg>
      );
    case "payments":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path strokeLinecap="round" d="M8 9h8" />
          <path strokeLinecap="round" d="M9 13.5h3.5a2 2 0 0 0 0-4H10" />
          <path strokeLinecap="round" d="M11 9.5v5" />
        </svg>
      );
    case "subscriptions":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <rect x="5" y="4" width="14" height="16" rx="2.5" />
          <path strokeLinecap="round" d="M8 9h8" />
          <path strokeLinecap="round" d="M8 13h5" />
          <path strokeLinecap="round" d="M8 17h4" />
        </svg>
      );
    case "command":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
          <path strokeLinecap="round" d="M8 9h8M8 12h8M8 15h5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m15.8 15.8 2.2 2.2M17.8 14.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5h15v11h-15zM8 10h8M8 13.5h5" />
        </svg>
      );
  }
}

export function HomePage() {
  const { role } = useAuth();
  const modules = NAV_ITEMS.filter((item) => item.path !== "/home" && (role ? item.roles.includes(role) : false));

  return (
    <section className="overflow-x-hidden">
      <div className="grid grid-cols-2 gap-5 p-5">
        {modules.map((module, index) => {
          const meta = MODULE_META[module.path] ?? { icon: "inventory" };
          return (
            <Link
              key={module.path}
              to={module.path}
              style={{ animationDelay: `${index * 50}ms` }}
              className={cn(
                "group home-card-enter aspect-square rounded-[20px] border border-[rgba(255,230,200,0.08)] bg-[#24201C] px-4 py-4",
                "shadow-[0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,230,200,0.05)]",
                "transition-all duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                "hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,230,200,0.07)]",
                "active:scale-[0.98]"
              )}
            >
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[rgba(230,134,46,0.08)] text-[#E6862E] transition-transform duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.05]">
                    <ModuleIcon type={meta.icon} />
                </div>
                <h2 className="text-base font-semibold tracking-tight text-[#F2E6D8] sm:text-lg">{module.label}</h2>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
