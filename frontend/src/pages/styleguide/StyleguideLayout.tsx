import { Link, useLocation, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import { navigation } from "./navigation"

export function StyleguideLayout() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Fixed */}
      <aside className="w-64 border-r border-border bg-card p-6 flex flex-col gap-6 fixed top-0 left-0 h-screen overflow-y-auto">
        <div>
          <Link to="/styleguide" className="text-xl font-bold text-foreground">
            Design System
          </Link>
          <p className="text-sm text-muted-foreground mt-1">BFIN Tokens</p>
        </div>

        <nav className="flex flex-col gap-6">
          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "block px-3 py-2 rounded-md text-sm transition-colors",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Back to App Link */}
        <div className="mt-auto pt-6 border-t border-border">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main content - offset by sidebar width */}
      <main className="flex-1 ml-64 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  )
}
