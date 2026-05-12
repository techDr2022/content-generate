import { LogOut, Settings, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  const navigate = useNavigate();

  function logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-3">
      <div className="text-sm font-semibold text-primary">techDr Content Studio</div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <User className="h-4 w-4" />
          {userName ?? "User"}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings">
            <Settings className="mr-1 h-4 w-4" />
            Settings
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-1 h-4 w-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}
