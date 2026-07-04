import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export interface PortalCredentials {
  title: string;
  email: string;
  password: string;
  loginUrl: string;
  portalLabel: string;
}

export function CredentialsDialog({
  creds,
  onClose,
}: {
  creds: PortalCredentials | null;
  onClose: () => void;
}) {
  if (!creds) return null;

  const copyAll = () => {
    const text = `${creds.portalLabel} Login\nEmail: ${creds.email}\nPassword: ${creds.password}\nURL: ${window.location.origin}${creds.loginUrl}`;
    void navigator.clipboard.writeText(text);
    toast.success("Credentials copied");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{creds.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Share these login details with them. They can sign in and open their {creds.portalLabel.toLowerCase()}.
        </p>
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm font-mono">
          <p><span className="text-muted-foreground font-sans">Email: </span>{creds.email}</p>
          <p><span className="text-muted-foreground font-sans">Password: </span>{creds.password}</p>
          <p><span className="text-muted-foreground font-sans">Login: </span>{creds.loginUrl}</p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={copyAll}><Copy className="h-4 w-4" /> Copy all</Button>
          <Button onClick={() => { window.open(creds.loginUrl, "_blank"); onClose(); }}>
            <ExternalLink className="h-4 w-4" /> Open login page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
