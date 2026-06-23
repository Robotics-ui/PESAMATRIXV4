import { Phone, Mail, MessageCircle, Clock } from "lucide-react";
import { useGetCustomerCareSettings, getGetCustomerCareSettingsQueryKey } from "@workspace/api-client-react";

function cleanPhone(phone: string): string {
  return phone.replace(/\s+/g, "");
}

function waNumber(phone: string): string {
  return cleanPhone(phone).replace(/^\+/, "");
}

export function CustomerCareFooter() {
  const { data: settings } = useGetCustomerCareSettings({
    query: { queryKey: getGetCustomerCareSettingsQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  if (!settings) return null;

  const hasContent =
    settings.phone1 || settings.phone2 || settings.whatsapp || settings.email;

  if (!hasContent) return null;

  return (
    <footer className="border-t border-border bg-card/20 px-4 py-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold text-muted-foreground shrink-0">
            Need Help?
          </span>

          {settings.phone1 && (
            <a
              href={`tel:${cleanPhone(settings.phone1)}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {settings.phone1}
            </a>
          )}

          {settings.phone2 && (
            <a
              href={`tel:${cleanPhone(settings.phone2)}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {settings.phone2}
            </a>
          )}

          {settings.whatsapp && (
            <a
              href={`https://wa.me/${waNumber(settings.whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-green-400 transition-colors"
            >
              <MessageCircle className="h-3 w-3 shrink-0" />
              WhatsApp: {settings.whatsapp}
            </a>
          )}

          {settings.email && (
            <a
              href={`mailto:${settings.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
            >
              <Mail className="h-3 w-3 shrink-0" />
              {settings.email}
            </a>
          )}

          {settings.supportHours && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {settings.supportHours}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
