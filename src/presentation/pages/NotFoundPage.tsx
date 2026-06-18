import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="h-full grid place-items-center p-10">
      <div className="text-center">
        <div className="text-5xl font-bold">404</div>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
